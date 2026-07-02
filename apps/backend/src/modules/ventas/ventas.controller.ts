import type { Request, Response } from "express";
import type { AnularVentaInput, CrearVentaInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as ventasService from "./ventas.service.js";

export async function crearController(req: Request, res: Response): Promise<void> {
  const venta = await ventasService.crearVenta(req.body as CrearVentaInput, req.usuario!.id);
  res.status(201).json(venta);
}

export async function buscarController(req: Request, res: Response): Promise<void> {
  res.json(await ventasService.buscarVenta(parseId(req.params.id)));
}

export async function listarController(req: Request, res: Response): Promise<void> {
  const usuarioId = req.query.usuarioId ? Number(req.query.usuarioId) : undefined;
  const estado = typeof req.query.estado === "string" ? req.query.estado : undefined;
  res.json(await ventasService.listarVentas({ usuarioId, estado }));
}

export async function anularController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const venta = await ventasService.anularVenta(
    id,
    req.body as AnularVentaInput,
    req.usuario!.id,
  );
  res.json(venta);
}
