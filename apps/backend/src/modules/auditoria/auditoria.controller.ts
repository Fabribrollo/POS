import type { Request, Response } from "express";
import type { AuditoriaQuery } from "@pos/shared";
import { generarExcel, generarPdf } from "../reportes/reportes.exportar.js";
import * as auditoriaService from "./auditoria.service.js";

function query(req: Request): AuditoriaQuery {
  return req.queryValidado as AuditoriaQuery;
}

const COLUMNAS = [
  { header: "Fecha", key: "fecha" },
  { header: "Usuario", key: "usuario" },
  { header: "Acción", key: "accion" },
  { header: "Entidad", key: "entidad" },
  { header: "ID", key: "entidadId" },
  { header: "Detalle", key: "detalle" },
];

const FILAS_EXPORT = { pagina: 1, porPagina: 10000 } as const;

function aFilaExport(log: Awaited<ReturnType<typeof auditoriaService.listar>>["datos"][number]) {
  return {
    fecha: new Date(log.fecha).toLocaleString("es-AR"),
    usuario: log.usuario,
    accion: log.accion,
    entidad: log.entidad,
    entidadId: log.entidadId ?? "-",
    detalle: log.detalle ? JSON.stringify(log.detalle) : "-",
  };
}

export async function listarController(req: Request, res: Response): Promise<void> {
  res.json(await auditoriaService.listar(query(req)));
}

export async function exportarExcelController(req: Request, res: Response): Promise<void> {
  const { datos } = await auditoriaService.listar({ ...query(req), ...FILAS_EXPORT });
  const buffer = generarExcel("Auditoría", COLUMNAS, datos.map(aFilaExport));
  res
    .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set("Content-Disposition", 'attachment; filename="auditoria.xlsx"')
    .send(buffer);
}

export async function exportarPdfController(req: Request, res: Response): Promise<void> {
  const { datos, total } = await auditoriaService.listar({ ...query(req), ...FILAS_EXPORT });
  const buffer = await generarPdf("Auditoría", COLUMNAS, datos.map(aFilaExport), [
    { label: "Cantidad de registros", valor: String(total) },
  ]);
  res
    .set("Content-Type", "application/pdf")
    .set("Content-Disposition", 'attachment; filename="auditoria.pdf"')
    .send(buffer);
}
