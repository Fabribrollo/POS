import type { Prisma } from "../../../generated/prisma/index.js";
import type { AjusteStockInput, EgresoStockInput, IngresoStockInput } from "@pos/shared";
import { TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { eventBus } from "../../core/events/eventBus.js";
import { buscarProducto } from "../productos/productos.service.js";
import * as productosRepository from "../productos/productos.repository.js";
import * as stockRepository from "./stock.repository.js";

export async function resolverDepositoId(depositoId?: number): Promise<number> {
  if (depositoId) return depositoId;
  const principal = await stockRepository.buscarDepositoPrincipal();
  if (!principal) {
    throw new BusinessRuleError("No hay un depósito principal configurado");
  }
  return principal.id;
}

export async function validarProductoYVariante(productoId: number, varianteId?: number) {
  const producto = await buscarProducto(productoId);
  if (varianteId) {
    const variante = await productosRepository.buscarVariantePorId(varianteId);
    if (!variante || variante.productoId !== productoId) {
      throw new NotFoundError("Variante no encontrada para este producto");
    }
  }
  return producto;
}

export interface MovimientoContext {
  productoId: number;
  varianteId?: number;
  depositoId: number;
  usuarioId: number;
}

// Núcleo reutilizable: recibe el `tx` en vez de abrir su propia transacción,
// para que ventas/devoluciones puedan descontar stock dentro de la MISMA
// transacción atómica que registra la venta y el movimiento de caja. Si algo
// falla a mitad de camino, todo se revierte junto (nunca queda una venta sin
// su descuento de stock, ni viceversa).
export async function aplicarMovimientoStockTx(
  tx: Prisma.TransactionClient,
  ctx: MovimientoContext,
  tipo: string,
  delta: number,
  motivo: string | undefined,
  referencia?: { tipo: string; id: number },
) {
  const stock = await stockRepository.buscarOCrearStock(
    tx,
    ctx.productoId,
    ctx.varianteId,
    ctx.depositoId,
  );

  const stockNuevo = stock.cantidad + delta;
  if (stockNuevo < 0) {
    throw new BusinessRuleError(
      `Stock insuficiente: hay ${stock.cantidad} y se intentan retirar ${-delta}`,
    );
  }

  await stockRepository.actualizarCantidad(tx, stock.id, stockNuevo);

  const movimiento = await stockRepository.crearMovimiento(tx, {
    productoId: ctx.productoId,
    varianteId: ctx.varianteId,
    depositoId: ctx.depositoId,
    tipo,
    cantidad: delta,
    stockAnterior: stock.cantidad,
    stockNuevo,
    motivo,
    referenciaTipo: referencia?.tipo,
    referenciaId: referencia?.id,
    usuarioId: ctx.usuarioId,
  });

  return { movimiento, stockNuevo };
}

export async function registrarIngreso(input: IngresoStockInput, usuarioId: number) {
  await validarProductoYVariante(input.productoId, input.varianteId);
  const depositoId = await resolverDepositoId(input.depositoId);

  const { movimiento } = await prisma.$transaction((tx) =>
    aplicarMovimientoStockTx(
      tx,
      { productoId: input.productoId, varianteId: input.varianteId, depositoId, usuarioId },
      TIPO_MOVIMIENTO_STOCK.INGRESO,
      input.cantidad,
      input.motivo,
    ),
  );
  return movimiento;
}

export async function registrarEgreso(input: EgresoStockInput, usuarioId: number) {
  const producto = await validarProductoYVariante(input.productoId, input.varianteId);
  const depositoId = await resolverDepositoId(input.depositoId);

  const { movimiento, stockNuevo } = await prisma.$transaction((tx) =>
    aplicarMovimientoStockTx(
      tx,
      { productoId: input.productoId, varianteId: input.varianteId, depositoId, usuarioId },
      TIPO_MOVIMIENTO_STOCK.EGRESO,
      -input.cantidad,
      input.motivo,
    ),
  );

  if (stockNuevo <= producto.stockMinimo) {
    eventBus.emitEvent("stock.bajo", {
      productoId: producto.id,
      cantidad: stockNuevo,
      stockMinimo: producto.stockMinimo,
    });
  }

  return movimiento;
}

export async function registrarAjuste(input: AjusteStockInput, usuarioId: number) {
  await validarProductoYVariante(input.productoId, input.varianteId);
  const depositoId = await resolverDepositoId(input.depositoId);

  return prisma.$transaction(async (tx) => {
    const stock = await stockRepository.buscarOCrearStock(
      tx,
      input.productoId,
      input.varianteId,
      depositoId,
    );
    const delta = input.cantidadNueva - stock.cantidad;

    await stockRepository.actualizarCantidad(tx, stock.id, input.cantidadNueva);

    return stockRepository.crearMovimiento(tx, {
      productoId: input.productoId,
      varianteId: input.varianteId,
      depositoId,
      tipo: TIPO_MOVIMIENTO_STOCK.AJUSTE,
      cantidad: delta,
      stockAnterior: stock.cantidad,
      stockNuevo: input.cantidadNueva,
      motivo: input.motivo,
      usuarioId,
    });
  });
}

export function listarMovimientos(filtros: { productoId?: number; tipo?: string }) {
  return stockRepository.listarMovimientos(filtros);
}

export async function listarStockDeProducto(productoId: number) {
  await buscarProducto(productoId);
  return stockRepository.listarStockDeProducto(productoId);
}

export async function listarStockBajo() {
  const productos = await stockRepository.listarProductosActivosConStock();
  return productos
    .map((producto) => {
      const stockTotal = producto.stock.reduce((acc, s) => acc + s.cantidad, 0);
      return { ...producto, stockTotal };
    })
    .filter((producto) => producto.stockTotal <= producto.stockMinimo);
}
