import type { Request, Response } from "express";
import type { ActualizarCategoriaInput, CrearCategoriaInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as categoriasService from "./categorias.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await categoriasService.listarCategorias());
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const categoria = await categoriasService.crearCategoria(req.body as CrearCategoriaInput);
  res.status(201).json(categoria);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const categoria = await categoriasService.actualizarCategoria(
    id,
    req.body as ActualizarCategoriaInput,
  );
  res.json(categoria);
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await categoriasService.desactivarCategoria(id));
}
