import type { Request, Response } from "express";
import type { ActualizarMarcaInput, CrearMarcaInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as marcasService from "./marcas.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await marcasService.listarMarcas());
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const marca = await marcasService.crearMarca(req.body as CrearMarcaInput);
  res.status(201).json(marca);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await marcasService.actualizarMarca(id, req.body as ActualizarMarcaInput));
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await marcasService.desactivarMarca(id));
}
