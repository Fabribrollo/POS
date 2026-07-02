import { prisma } from "../../core/prisma.js";

export interface RangoFechas {
  desde?: Date;
  hasta?: Date;
}

function rangoCreatedAt(rango: RangoFechas) {
  if (!rango.desde && !rango.hasta) return undefined;
  return { gte: rango.desde, lte: rango.hasta };
}

export function ventasCompletadas(rango: RangoFechas) {
  return prisma.venta.findMany({
    where: { estado: "COMPLETADA", createdAt: rangoCreatedAt(rango) },
    select: { id: true, numero: true, total: true, usuarioId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function ventasPorVendedor(rango: RangoFechas) {
  const agrupado = await prisma.venta.groupBy({
    by: ["usuarioId"],
    where: { estado: "COMPLETADA", createdAt: rangoCreatedAt(rango) },
    _sum: { total: true },
    _count: { _all: true },
  });
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: agrupado.map((g) => g.usuarioId) } },
    select: { id: true, nombre: true },
  });
  return { agrupado, usuarios };
}

export async function productosMasVendidos(rango: RangoFechas, take: number) {
  const agrupado = await prisma.itemVenta.groupBy({
    by: ["productoId"],
    where: { venta: { estado: "COMPLETADA", createdAt: rangoCreatedAt(rango) } },
    _sum: { cantidad: true, subtotal: true },
    orderBy: { _sum: { cantidad: "desc" } },
    take,
  });
  const productos = await prisma.producto.findMany({
    where: { id: { in: agrupado.map((g) => g.productoId) } },
    select: { id: true, nombre: true, codigoInterno: true },
  });
  return { agrupado, productos };
}

export function itemsParaRentabilidad(rango: RangoFechas) {
  return prisma.itemVenta.findMany({
    where: { venta: { estado: "COMPLETADA", createdAt: rangoCreatedAt(rango) } },
    select: { cantidad: true, costoUnitario: true },
  });
}

export function ventasTotalPeriodo(rango: RangoFechas) {
  return prisma.venta.aggregate({
    where: { estado: "COMPLETADA", createdAt: rangoCreatedAt(rango) },
    _sum: { total: true },
  });
}

export function egresosOperativos(rango: RangoFechas) {
  return prisma.movimientoCaja.aggregate({
    where: { tipo: "EGRESO", ventaId: null, createdAt: rangoCreatedAt(rango) },
    _sum: { monto: true },
  });
}

export function stockConProducto() {
  return prisma.stock.findMany({ include: { producto: true } });
}

export async function productosSinMovimientoDesde(cutoff: Date) {
  const movimientos = await prisma.movimientoStock.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { productoId: true },
    distinct: ["productoId"],
  });
  const idsConMovimiento = movimientos.map((m) => m.productoId);
  return prisma.producto.findMany({
    where: { activo: true, id: { notIn: idsConMovimiento } },
  });
}
