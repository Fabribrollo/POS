import type { CrearDevolucionInput } from "@pos/shared";
import { TIPO_DEVOLUCION, TIPO_MOVIMIENTO_CAJA, TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as cajaService from "../caja/caja.service.js";
import { aplicarMovimientoStockTx, resolverDepositoId, validarProductoYVariante } from "../stock/stock.service.js";
import * as devolucionesRepository from "./devoluciones.repository.js";

const TIPOS_CAMBIO: readonly string[] = [
  TIPO_DEVOLUCION.CAMBIO_PRODUCTO,
  TIPO_DEVOLUCION.CAMBIO_TALLE,
  TIPO_DEVOLUCION.CAMBIO_OTRO_PRODUCTO,
];

export async function crearDevolucion(input: CrearDevolucionInput, usuarioId: number) {
  const venta = await devolucionesRepository.buscarVentaConItems(input.ventaOriginalId);
  if (!venta) throw new NotFoundError("Venta original no encontrada");
  if (venta.estado !== "COMPLETADA") {
    throw new BusinessRuleError("Solo se pueden procesar devoluciones de ventas completadas");
  }

  const esCambio = TIPOS_CAMBIO.includes(input.tipo);

  for (const item of input.items) {
    const itemVenta = venta.items.find((i) => i.id === item.itemVentaId);
    if (!itemVenta) {
      throw new BusinessRuleError("El ítem indicado no pertenece a la venta original");
    }

    const { _sum } = await devolucionesRepository.sumaDevueltaPorItem(item.itemVentaId);
    const yaDevuelto = _sum.cantidad ?? 0;
    const disponible = itemVenta.cantidad - yaDevuelto;
    if (item.cantidad > disponible) {
      throw new BusinessRuleError(
        `Solo quedan ${disponible} unidades disponibles para devolver de este ítem (ya se devolvieron ${yaDevuelto})`,
      );
    }

    if (esCambio) {
      if (!item.productoNuevoId) {
        throw new BusinessRuleError("Un cambio requiere indicar el producto nuevo");
      }
      await validarProductoYVariante(item.productoNuevoId, item.varianteNuevaId);
    }
  }

  const depositoId = await resolverDepositoId();

  let cajaId: number | undefined;
  if (input.montoReintegro !== 0 && input.tipo !== TIPO_DEVOLUCION.NOTA_CREDITO) {
    const caja = await cajaService.obtenerCajaAbierta();
    cajaId = caja.id;
  }

  return prisma.$transaction(async (tx) => {
    const devolucion = await devolucionesRepository.crear(tx, {
      ventaOriginalId: input.ventaOriginalId,
      clienteId: venta.clienteId ?? undefined,
      tipo: input.tipo,
      montoReintegro: input.montoReintegro,
      motivo: input.motivo,
      usuarioId,
      items: input.items,
    });

    for (const item of input.items) {
      const itemVenta = venta.items.find((i) => i.id === item.itemVentaId)!;

      // El producto original vuelve a stock.
      await aplicarMovimientoStockTx(
        tx,
        {
          productoId: itemVenta.productoId,
          varianteId: itemVenta.varianteId ?? undefined,
          depositoId,
          usuarioId,
        },
        TIPO_MOVIMIENTO_STOCK.DEVOLUCION,
        item.cantidad,
        `Devolución venta ${venta.numero}`,
        { tipo: "DEVOLUCION", id: devolucion.id },
      );

      // En un cambio, el producto nuevo entregado sale de stock.
      if (esCambio && item.productoNuevoId) {
        await aplicarMovimientoStockTx(
          tx,
          {
            productoId: item.productoNuevoId,
            varianteId: item.varianteNuevaId,
            depositoId,
            usuarioId,
          },
          TIPO_MOVIMIENTO_STOCK.DEVOLUCION,
          -item.cantidad,
          `Cambio por venta ${venta.numero}`,
          { tipo: "DEVOLUCION", id: devolucion.id },
        );
      }
    }

    if (cajaId && input.montoReintegro !== 0) {
      // Reintegro positivo: sale efectivo de la caja. Negativo: el cliente
      // paga la diferencia en un cambio por un producto más caro.
      await cajaService.registrarMovimientoTx(tx, {
        cajaId,
        tipo: input.montoReintegro > 0 ? TIPO_MOVIMIENTO_CAJA.EGRESO : TIPO_MOVIMIENTO_CAJA.INGRESO,
        monto: Math.abs(input.montoReintegro),
        concepto: `Devolución venta ${venta.numero}`,
        usuarioId,
        ventaId: venta.id,
      });
    }

    return devolucion;
  });
}

export async function buscarDevolucion(id: number) {
  const devolucion = await devolucionesRepository.buscarPorId(id);
  if (!devolucion) throw new NotFoundError("Devolución no encontrada");
  return devolucion;
}

export function listarPorVenta(ventaOriginalId: number) {
  return devolucionesRepository.listarPorVenta(ventaOriginalId);
}
