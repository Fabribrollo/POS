import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function crear(
  db: Db,
  data: {
    usuarioId?: number;
    accion: string;
    entidad: string;
    entidadId?: number;
    detalle?: string;
  },
) {
  return db.logAuditoria.create({ data });
}

const CAMPOS_ORDEN = new Set(["createdAt", "accion", "entidad"]);

export interface FiltrosAuditoria {
  desde?: Date;
  hasta?: Date;
  usuarioId?: number;
  entidad?: string;
  accion?: string;
  busqueda?: string;
}

export async function listarPaginado(
  filtros: FiltrosAuditoria,
  paginacion: { pagina: number; porPagina: number },
  orden: { ordenarPor?: string; direccion: "asc" | "desc" },
) {
  const campoOrden = orden.ordenarPor && CAMPOS_ORDEN.has(orden.ordenarPor) ? orden.ordenarPor : "createdAt";
  const where: Prisma.LogAuditoriaWhereInput = {
    createdAt: { gte: filtros.desde, lte: filtros.hasta },
    usuarioId: filtros.usuarioId,
    entidad: filtros.entidad,
    accion: filtros.accion,
    ...(filtros.busqueda
      ? {
          OR: [
            { entidad: { contains: filtros.busqueda } },
            { accion: { contains: filtros.busqueda } },
            { usuario: { nombre: { contains: filtros.busqueda } } },
            { detalle: { contains: filtros.busqueda } },
          ],
        }
      : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.logAuditoria.findMany({
      where,
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.logAuditoria.count({ where }),
  ]);

  return { datos, total };
}
