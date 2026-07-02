import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

const includeCompleto = {
  proveedor: true,
  items: { include: { producto: true, variante: true } },
} as const;

export async function siguienteNumero(db: Db): Promise<string> {
  const total = await db.compra.count();
  return `OC-${String(total + 1).padStart(6, "0")}`;
}

export function crear(
  db: Db,
  data: {
    numero: string;
    proveedorId: number;
    total: number;
    items: {
      productoId: number;
      varianteId?: number;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }[];
  },
) {
  return db.compra.create({
    data: {
      numero: data.numero,
      proveedorId: data.proveedorId,
      total: data.total,
      items: { create: data.items },
    },
    include: includeCompleto,
  });
}

export function buscarPorId(db: Db, id: number) {
  return db.compra.findUnique({ where: { id }, include: includeCompleto });
}

export function actualizarEstado(db: Db, id: number, estado: string) {
  return db.compra.update({ where: { id }, data: { estado }, include: includeCompleto });
}

export function listar() {
  return prisma.compra.findMany({
    include: includeCompleto,
    orderBy: { createdAt: "desc" },
  });
}

export function actualizarPrecioCosto(db: Db, productoId: number, precioCosto: number) {
  return db.producto.update({ where: { id: productoId }, data: { precioCosto } });
}
