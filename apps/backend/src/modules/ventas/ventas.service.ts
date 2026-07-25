import type { AnularVentaInput, CrearVentaInput } from "@pos/shared";
import { ACCION_AUDITORIA, ENTIDAD_AUDITORIA, MEDIOS_PAGO, TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { registrar } from "../auditoria/auditoria.service.js";
import * as cajaService from "../caja/caja.service.js";
import { buscarCliente, registrarMovimientoCCTx, saldoCCTx } from "../clientes/clientes.service.js";
import { aplicarMovimientoStockTx, resolverDepositoId, validarProductoYVariante } from "../stock/stock.service.js";
import * as ventasRepository from "./ventas.repository.js";

const TOLERANCIA_CENTAVOS = 0.01;

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function totalEfectivo(pagos: CrearVentaInput["pagos"]): number {
  return pagos
    .filter((p) => p.medioPago === MEDIOS_PAGO.EFECTIVO)
    .reduce((acc, p) => acc + p.monto + p.recargo, 0);
}

export async function crearVenta(input: CrearVentaInput, usuarioId: number) {
  const caja = await cajaService.obtenerCajaAbierta();
  const depositoId = await resolverDepositoId();

  if (input.clienteId) {
    await buscarCliente(input.clienteId);
  }

  // El saldo a favor sale de la cuenta corriente del cliente (una nota de
  // crédito de una devolución previa), no de un medio de pago externo.
  const montoSaldoUsado = redondear(
    input.pagos
      .filter((p) => p.medioPago === MEDIOS_PAGO.SALDO_A_FAVOR)
      .reduce((acc, p) => acc + p.monto, 0),
  );
  if (montoSaldoUsado > 0) {
    if (!input.clienteId) {
      throw new BusinessRuleError("Para usar saldo a favor la venta debe tener un cliente asociado");
    }
    const saldo = await saldoCCTx(prisma, input.clienteId);
    const creditoDisponible = saldo < 0 ? -saldo : 0;
    if (montoSaldoUsado > creditoDisponible + TOLERANCIA_CENTAVOS) {
      throw new BusinessRuleError(
        `El cliente no tiene suficiente saldo a favor (disponible: $${creditoDisponible})`,
      );
    }
  }

  // Validar existencia de cada producto/variante antes de tocar la DB en
  // escritura (falla rápido con un mensaje claro en vez de un rollback
  // tardío) y capturar precioCosto/precioVenta vigentes como snapshot. El
  // precioUnitario que manda el cliente NUNCA se usa para calcular montos:
  // se ignora a propósito y se recalcula siempre a partir del precio real
  // del catálogo, para que nadie pueda vender un producto a un precio
  // inventado con una request armada a mano (el frontend ya envía el precio
  // de catálogo de todos modos, así que esto no cambia el flujo normal).
  const costoPorProducto = new Map<number, number>();
  const precioPorProducto = new Map<number, number>();
  for (const item of input.items) {
    const producto = await validarProductoYVariante(item.productoId, item.varianteId);
    costoPorProducto.set(item.productoId, Number(producto.precioCosto));
    precioPorProducto.set(item.productoId, Number(producto.precioVenta));
  }

  for (const item of input.items) {
    const precioReal = precioPorProducto.get(item.productoId)!;
    if (item.descuento > redondear(item.cantidad * precioReal) + TOLERANCIA_CENTAVOS) {
      throw new BusinessRuleError(
        `El descuento de un ítem no puede superar su propio subtotal`,
      );
    }
  }

  const subtotal = redondear(
    input.items.reduce((acc, item) => {
      const precioReal = precioPorProducto.get(item.productoId)!;
      return acc + item.cantidad * precioReal - item.descuento;
    }, 0),
  );
  if (input.descuentoTotal > subtotal + TOLERANCIA_CENTAVOS) {
    throw new BusinessRuleError("El descuento total no puede superar el subtotal de la venta");
  }
  const total = Math.max(0, redondear(subtotal - input.descuentoTotal));

  const totalPagos = redondear(input.pagos.reduce((acc, p) => acc + p.monto + p.recargo, 0));
  if (Math.abs(totalPagos - total) > TOLERANCIA_CENTAVOS) {
    throw new BusinessRuleError(
      `Los pagos (${totalPagos}) no cubren el total de la venta (${total})`,
    );
  }

  const pagosConMedio = await Promise.all(
    input.pagos.map(async (pago) => {
      const medioPago = await ventasRepository.buscarMedioPagoPorNombre(prisma, pago.medioPago);
      if (!medioPago) throw new BusinessRuleError(`Medio de pago inválido: ${pago.medioPago}`);
      return {
        medioPagoId: medioPago.id,
        monto: pago.monto,
        cuotas: pago.cuotas,
        recargo: pago.recargo,
        referencia: pago.referencia,
      };
    }),
  );

  const venta = await prisma.$transaction(async (tx) => {
    const ventaCreada = await ventasRepository.crear(tx, {
      clienteId: input.clienteId,
      usuarioId,
      cajaId: caja.id,
      subtotal,
      descuentoTotal: input.descuentoTotal,
      total,
      items: input.items.map((item) => {
        const precioReal = precioPorProducto.get(item.productoId)!;
        return {
          productoId: item.productoId,
          varianteId: item.varianteId,
          cantidad: item.cantidad,
          precioUnitario: precioReal,
          costoUnitario: costoPorProducto.get(item.productoId)!,
          descuento: item.descuento,
          subtotal: redondear(item.cantidad * precioReal - item.descuento),
        };
      }),
      pagos: pagosConMedio,
    });

    for (const item of input.items) {
      await aplicarMovimientoStockTx(
        tx,
        { productoId: item.productoId, varianteId: item.varianteId, depositoId, usuarioId },
        TIPO_MOVIMIENTO_STOCK.VENTA,
        -item.cantidad,
        undefined,
        { tipo: "VENTA", id: ventaCreada.id },
      );
    }

    const efectivo = redondear(totalEfectivo(input.pagos));
    if (efectivo > 0) {
      await cajaService.registrarMovimientoVenta(tx, caja.id, efectivo, ventaCreada.id, usuarioId);
    }

    if (montoSaldoUsado > 0) {
      await registrarMovimientoCCTx(tx, input.clienteId!, "DEBITO", montoSaldoUsado, ventaCreada.id);
    }

    await registrar(tx, {
      usuarioId,
      accion: ACCION_AUDITORIA.CREAR,
      entidad: ENTIDAD_AUDITORIA.VENTA,
      entidadId: ventaCreada.id,
      detalle: { numero: ventaCreada.numero, total, cantidadItems: input.items.length },
    });

    return ventaCreada;
  });

  return venta;
}

export async function buscarVenta(id: number) {
  const venta = await ventasRepository.buscarPorId(id);
  if (!venta) throw new NotFoundError("Venta no encontrada");
  return venta;
}

export function listarVentas(filtros: { usuarioId?: number; estado?: string }) {
  return ventasRepository.listar(filtros);
}

// Solo se puede anular mientras la caja de esa venta sigue abierta: revertir
// stock y efectivo sobre una caja ya cerrada corrompería un arqueo que ya se
// dio por conciliado.
export async function anularVenta(id: number, input: AnularVentaInput, usuarioId: number) {
  const venta = await buscarVenta(id);

  if (venta.estado === "ANULADA") {
    throw new BusinessRuleError("La venta ya está anulada");
  }
  if (venta.caja.estado !== "ABIERTA") {
    throw new BusinessRuleError(
      "No se puede anular una venta de un turno de caja que ya fue cerrado",
    );
  }

  const depositoId = await resolverDepositoId();

  return prisma.$transaction(async (tx) => {
    for (const item of venta.items) {
      await aplicarMovimientoStockTx(
        tx,
        {
          productoId: item.productoId,
          varianteId: item.varianteId ?? undefined,
          depositoId,
          usuarioId,
        },
        TIPO_MOVIMIENTO_STOCK.DEVOLUCION,
        item.cantidad,
        `Anulación de venta ${venta.numero}`,
        { tipo: "VENTA", id: venta.id },
      );
    }

    const efectivo = redondear(
      venta.pagos
        .filter((p) => p.medioPago.nombre === MEDIOS_PAGO.EFECTIVO)
        .reduce((acc, p) => acc + Number(p.monto) + Number(p.recargo ?? 0), 0),
    );
    if (efectivo > 0) {
      await cajaService.revertirMovimientoVenta(tx, venta.cajaId, efectivo, venta.id, usuarioId);
    }

    await registrar(tx, {
      usuarioId,
      accion: ACCION_AUDITORIA.ANULAR,
      entidad: ENTIDAD_AUDITORIA.VENTA,
      entidadId: venta.id,
      detalle: { numero: venta.numero, motivo: input.motivo },
    });

    return ventasRepository.anular(tx, id, input.motivo);
  });
}
