import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import type { AuditoriaQuery } from "@pos/shared";
import * as auditoriaRepository from "./auditoria.repository.js";

type Db = PrismaClient | Prisma.TransactionClient;

const DIAS_RANGO_DEFAULT = 30;

// Función central que el resto de los módulos importa para dejar constancia
// de una acción. Recibe `db` (PrismaClient o el `tx` de una transacción en
// curso) para poder registrar el log DENTRO de la misma transacción que la
// operación real: si la operación falla y se revierte, el log también, y
// nunca queda un log de algo que en realidad no se aplicó.
export function registrar(
  db: Db,
  data: {
    usuarioId?: number;
    accion: string;
    entidad: string;
    entidadId?: number;
    detalle?: Record<string, unknown>;
  },
) {
  return auditoriaRepository.crear(db, {
    usuarioId: data.usuarioId,
    accion: data.accion,
    entidad: data.entidad,
    entidadId: data.entidadId,
    detalle: data.detalle ? JSON.stringify(data.detalle) : undefined,
  });
}

function resolverRango(desde?: Date, hasta?: Date): { desde: Date; hasta: Date } {
  if (!desde && !hasta) {
    const hastaDefault = new Date();
    const desdeDefault = new Date();
    desdeDefault.setDate(desdeDefault.getDate() - DIAS_RANGO_DEFAULT);
    return { desde: desdeDefault, hasta: hastaDefault };
  }
  return { desde: desde ?? new Date(0), hasta: hasta ?? new Date() };
}

export async function listar(query: AuditoriaQuery) {
  const rango = resolverRango(query.desde, query.hasta);
  const { datos, total } = await auditoriaRepository.listarPaginado(
    {
      desde: rango.desde,
      hasta: rango.hasta,
      usuarioId: query.usuarioId,
      entidad: query.entidad,
      accion: query.accion,
      busqueda: query.busqueda,
    },
    { pagina: query.pagina, porPagina: query.porPagina },
    { ordenarPor: query.ordenarPor, direccion: query.direccion },
  );

  return {
    datos: datos.map((log) => ({
      id: log.id,
      fecha: log.createdAt,
      usuario: log.usuario?.nombre ?? "Sistema",
      accion: log.accion,
      entidad: log.entidad,
      entidadId: log.entidadId,
      detalle: log.detalle ? (JSON.parse(log.detalle) as Record<string, unknown>) : null,
    })),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
  };
}
