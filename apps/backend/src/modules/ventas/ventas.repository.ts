import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

const includeCompleto = {
  cliente: true,
  usuario: { select: { id: true, nombre: true } },
  caja: true,
  items: { include: { producto: true, variante: true } },
  pagos: { include: { medioPago: true } },
} as const;

export function buscarMedioPagoPorNombre(db: Db, nombre: string) {
  return db.medioPago.findUnique({ where: { nombre } });
}

export async function siguienteNumero(db: Db): Promise<string> {
  const total = await db.venta.count();
  return String(total + 1).padStart(8, "0");
}

export function crear(
  db: Db,
  data: {
    numero: string;
    clienteId?: number;
    usuarioId: number;
    cajaId: number;
    subtotal: number;
    descuentoTotal: number;
    total: number;
    items: {
      productoId: number;
      varianteId?: number;
      cantidad: number;
      precioUnitario: number;
      costoUnitario: number;
      descuento: number;
      subtotal: number;
    }[];
    pagos: {
      medioPagoId: number;
      monto: number;
      cuotas?: number;
      recargo: number;
      referencia?: string;
    }[];
  },
) {
  return db.venta.create({
    data: {
      numero: data.numero,
      clienteId: data.clienteId,
      usuarioId: data.usuarioId,
      cajaId: data.cajaId,
      subtotal: data.subtotal,
      descuentoTotal: data.descuentoTotal,
      total: data.total,
      items: { create: data.items },
      pagos: { create: data.pagos },
    },
    include: includeCompleto,
  });
}

export function buscarPorId(id: number) {
  return prisma.venta.findUnique({ where: { id }, include: includeCompleto });
}

export function anular(db: Db, id: number, motivo: string) {
  return db.venta.update({
    where: { id },
    data: { estado: "ANULADA", motivoAnulacion: motivo },
    include: includeCompleto,
  });
}

export function listar(filtros: { usuarioId?: number; estado?: string; take?: number }) {
  return prisma.venta.findMany({
    where: { usuarioId: filtros.usuarioId, estado: filtros.estado },
    include: includeCompleto,
    orderBy: { createdAt: "desc" },
    take: filtros.take ?? 100,
  });
}
