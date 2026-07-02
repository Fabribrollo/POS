import type { Request, Response } from "express";
import type { RangoFechas } from "./reportes.repository.js";
import * as reportesService from "./reportes.service.js";

function parseRango(req: Request): RangoFechas {
  const desde = typeof req.query.desde === "string" ? new Date(req.query.desde) : undefined;
  const hasta = typeof req.query.hasta === "string" ? new Date(req.query.hasta) : undefined;
  return { desde, hasta };
}

export async function ventasPorPeriodoController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.ventasPorPeriodo(parseRango(req)));
}

export async function ventasPorVendedorController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.ventasPorVendedor(parseRango(req)));
}

export async function productosMasVendidosController(req: Request, res: Response): Promise<void> {
  const take = req.query.take ? Number(req.query.take) : undefined;
  res.json(await reportesService.productosMasVendidos(parseRango(req), take));
}

export async function rentabilidadController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.rentabilidad(parseRango(req)));
}

export async function stockValorizadoController(_req: Request, res: Response): Promise<void> {
  res.json(await reportesService.stockValorizado());
}

export async function productosSinMovimientoController(
  req: Request,
  res: Response,
): Promise<void> {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  res.json(await reportesService.productosSinMovimiento(dias));
}
