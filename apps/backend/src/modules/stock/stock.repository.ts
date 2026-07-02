import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function buscarDepositoPrincipal(db: Db = prisma) {
  return db.deposito.findFirst({ where: { principal: true } });
}

// No usamos el upsert nativo de Prisma sobre la unique compuesta
// (productoId, varianteId, depositoId) porque varianteId es nullable: SQLite
// (como la mayoría de los motores SQL) trata cada NULL como distinto dentro
// de un índice único, así que el ON CONFLICT de un upsert nunca dispara para
// productos sin variante y terminaría insertando filas de Stock duplicadas.
// En su lugar resolvemos manualmente find-then-write dentro de la misma
// transacción que ya envuelve cada movimiento.
export async function buscarOCrearStock(
  db: Db,
  productoId: number,
  varianteId: number | undefined,
  depositoId: number,
) {
  const existente = await db.stock.findFirst({
    where: { productoId, varianteId: varianteId ?? null, depositoId },
  });
  if (existente) return existente;

  return db.stock.create({
    data: { productoId, varianteId, depositoId, cantidad: 0 },
  });
}

export function actualizarCantidad(db: Db, stockId: number, cantidad: number) {
  return db.stock.update({ where: { id: stockId }, data: { cantidad } });
}

export function crearMovimiento(
  db: Db,
  data: {
    productoId: number;
    varianteId?: number;
    depositoId: number;
    tipo: string;
    cantidad: number;
    stockAnterior: number;
    stockNuevo: number;
    motivo?: string;
    referenciaTipo?: string;
    referenciaId?: number;
    usuarioId: number;
  },
) {
  return db.movimientoStock.create({ data });
}

export function listarMovimientos(filtros: { productoId?: number; tipo?: string; take?: number }) {
  return prisma.movimientoStock.findMany({
    where: {
      productoId: filtros.productoId,
      tipo: filtros.tipo,
    },
    include: { producto: true, variante: true, usuario: { select: { id: true, nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: filtros.take ?? 100,
  });
}

export function listarStockDeProducto(productoId: number) {
  return prisma.stock.findMany({
    where: { productoId },
    include: { variante: true, deposito: true },
  });
}

export function listarProductosActivosConStock() {
  return prisma.producto.findMany({
    where: { activo: true },
    include: { stock: true },
  });
}
