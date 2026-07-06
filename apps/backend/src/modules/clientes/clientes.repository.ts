import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function listar() {
  return prisma.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
}

export function buscarPorId(id: number) {
  return prisma.cliente.findUnique({ where: { id } });
}

export function buscarPorDocumento(documento: string) {
  return prisma.cliente.findUnique({ where: { documento } });
}

export function crear(data: {
  nombre: string;
  documento?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  limiteCuentaCorriente?: number;
}) {
  return prisma.cliente.create({ data });
}

export function actualizar(id: number, data: Record<string, unknown>) {
  return prisma.cliente.update({ where: { id }, data });
}

export function historialCompras(clienteId: number) {
  return prisma.venta.findMany({
    where: { clienteId, estado: "COMPLETADA" },
    include: {
      items: { include: { producto: true, variante: true } },
      pagos: { include: { medioPago: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function ultimoMovimientoCC(db: Db, clienteId: number) {
  return db.movimientoCuentaCorriente.findFirst({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
  });
}

export function crearMovimientoCC(
  db: Db,
  data: {
    clienteId: number;
    tipo: string;
    monto: number;
    saldoAnterior: number;
    saldoNuevo: number;
    ventaId?: number;
  },
) {
  return db.movimientoCuentaCorriente.create({ data });
}

export function listarMovimientosCC(clienteId: number) {
  return prisma.movimientoCuentaCorriente.findMany({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
  });
}
