import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function buscarAbierta(db: Db = prisma) {
  return db.caja.findFirst({ where: { estado: "ABIERTA" } });
}

export function buscarPorId(id: number) {
  return prisma.caja.findUnique({ where: { id } });
}

export function crear(db: Db, usuarioAperturaId: number, montoApertura: number) {
  return db.caja.create({ data: { usuarioAperturaId, montoApertura } });
}

export function cerrar(
  db: Db,
  id: number,
  data: {
    usuarioCierreId: number;
    montoCierreDeclarado: number;
    montoCierreSistema: number;
    diferencia: number;
    observaciones?: string;
  },
) {
  return db.caja.update({
    where: { id },
    data: { ...data, estado: "CERRADA", fechaCierre: new Date() },
  });
}

export function crearMovimiento(
  db: Db,
  data: { cajaId: number; tipo: string; monto: number; concepto: string; usuarioId: number; ventaId?: number },
) {
  return db.movimientoCaja.create({ data });
}

export function listarMovimientos(cajaId: number) {
  return prisma.movimientoCaja.findMany({
    where: { cajaId },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function sumarMovimientos(db: Db, cajaId: number) {
  return db.movimientoCaja.findMany({ where: { cajaId } });
}

export function listarHistorial() {
  return prisma.caja.findMany({
    orderBy: { fechaApertura: "desc" },
    include: {
      usuarioApertura: { select: { id: true, nombre: true } },
      usuarioCierre: { select: { id: true, nombre: true } },
    },
  });
}
