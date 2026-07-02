import type { Request, Response } from "express";
import type { AsignarPrecioInput, CrearListaPrecioInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as listasPrecioService from "./listasPrecio.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await listasPrecioService.listarListasPrecio());
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const lista = await listasPrecioService.crearListaPrecio(req.body as CrearListaPrecioInput);
  res.status(201).json(lista);
}

export async function listarPreciosDeProductoController(
  req: Request,
  res: Response,
): Promise<void> {
  const productoId = parseId(req.params.productoId);
  res.json(await listasPrecioService.listarPreciosDeProducto(productoId));
}

export async function asignarPrecioController(req: Request, res: Response): Promise<void> {
  const precio = await listasPrecioService.asignarPrecio(req.body as AsignarPrecioInput);
  res.status(201).json(precio);
}
