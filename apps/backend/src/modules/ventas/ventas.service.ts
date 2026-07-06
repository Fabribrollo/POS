import type { AnularVentaInput, CrearVentaInput } from "@pos/shared";
import { MEDIOS_PAGO, TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
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
  // tardío) y capturar el precioCosto vigente como snapshot para la
  // rentabilidad histórica del reporte, que no debe moverse si el costo
  // cambia después por una compra futura.
  const costoPorProducto = new Map<number, number>();
  for (const item of input.items) {
    const producto = await validarProductoYVariante(item.productoId, item.varianteId);
    costoPorProducto.set(item.productoId, Number(producto.precioCosto));
  }

  const subtotal = redondear(
    input.items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario - item.descuento, 0),
  );
  const total = redondear(subtotal - input.descuentoTotal);

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
    const numero = await ventasRepository.siguienteNumero(tx);

    const ventaCreada = await ventasRepository.crear(tx, {
      numero,
      clienteId: input.clienteId,
      usuarioId,
      cajaId: caja.id,
      subtotal,
      descuentoTotal: input.descuentoTotal,
      total,
      items: input.items.map((item) => ({
        productoId: item.productoId,
        varianteId: item.varianteId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        costoUnitario: costoPorProducto.get(item.productoId)!,
        descuento: item.descuento,
        subtotal: redondear(item.cantidad * item.precioUnitario - item.descuento),
      })),
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

    return ventasRepository.anular(tx, id, input.motivo);
  });
}
