import type { Request, Response } from "express";
import type { CrearCompraInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as comprasService from "./compras.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await comprasService.listarCompras());
}

export async function buscarController(req: Request, res: Response): Promise<void> {
  res.json(await comprasService.buscarCompra(parseId(req.params.id)));
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const compra = await comprasService.crearCompra(req.body as CrearCompraInput, req.usuario!.id);
  res.status(201).json(compra);
}

export async function recibirController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await comprasService.recibirCompra(id, req.usuario!.id));
}

export async function anularController(req: Request, res: Response): Promise<void> {
  res.json(await comprasService.anularCompra(parseId(req.params.id)));
}
