import type { Request, Response } from "express";
import type { CrearDevolucionInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as devolucionesService from "./devoluciones.service.js";

export async function crearController(req: Request, res: Response): Promise<void> {
  const devolucion = await devolucionesService.crearDevolucion(
    req.body as CrearDevolucionInput,
    req.usuario!.id,
  );
  res.status(201).json(devolucion);
}

export async function buscarController(req: Request, res: Response): Promise<void> {
  res.json(await devolucionesService.buscarDevolucion(parseId(req.params.id)));
}

export async function listarPorVentaController(req: Request, res: Response): Promise<void> {
  const ventaOriginalId = parseId(req.params.ventaId);
  res.json(await devolucionesService.listarPorVenta(ventaOriginalId));
}
