import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

const includeCompleto = {
  proveedor: true,
  items: { include: { producto: true, variante: true } },
} as const;

function formatearNumero(id: number): string {
  return `OC-${String(id).padStart(6, "0")}`;
}

// El numero se deriva del id autoincremental (create-then-update) en vez de
// `count()+1`: dos compras creadas casi simultáneamente podían leer el mismo
// count() y chocar contra el @unique de numero con un 500 crudo. El id
// autoincremental de SQLite es atómico por diseño, nunca se repite. Mismo
// patrón que ventas.repository.ts y productos.repository.ts.
export async function crear(
  db: Db,
  data: {
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
  const creada = await db.compra.create({
    data: {
      numero: randomUUID(), // placeholder único: se reemplaza abajo
      proveedorId: data.proveedorId,
      total: data.total,
      items: { create: data.items },
    },
  });
  return db.compra.update({
    where: { id: creada.id },
    data: { numero: formatearNumero(creada.id) },
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
