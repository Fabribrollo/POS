import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function buscarVentaConItems(id: number) {
  return prisma.venta.findUnique({ where: { id }, include: { items: true } });
}

export function sumaDevueltaPorItem(itemVentaId: number) {
  return prisma.itemDevolucion.aggregate({
    where: { itemVentaId },
    _sum: { cantidad: true },
  });
}

export function crear(
  db: Db,
  data: {
    ventaOriginalId: number;
    clienteId?: number;
    tipo: string;
    montoReintegro: number;
    motivo?: string;
    usuarioId: number;
    items: {
      itemVentaId: number;
      cantidad: number;
      productoNuevoId?: number;
      varianteNuevaId?: number;
    }[];
  },
) {
  return db.devolucion.create({
    data: {
      ventaOriginalId: data.ventaOriginalId,
      clienteId: data.clienteId,
      tipo: data.tipo,
      montoReintegro: data.montoReintegro,
      motivo: data.motivo,
      usuarioId: data.usuarioId,
      items: { create: data.items },
    },
    include: { items: true },
  });
}

export function buscarPorId(id: number) {
  return prisma.devolucion.findUnique({
    where: { id },
    include: { items: true, ventaOriginal: true, usuario: { select: { id: true, nombre: true } } },
  });
}

export function listarPorVenta(ventaOriginalId: number) {
  return prisma.devolucion.findMany({
    where: { ventaOriginalId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}
