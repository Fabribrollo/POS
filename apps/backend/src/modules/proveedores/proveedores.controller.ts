import type { Request, Response } from "express";
import type { ActualizarProveedorInput, CrearProveedorInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as proveedoresService from "./proveedores.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await proveedoresService.listarProveedores());
}

export async function buscarController(req: Request, res: Response): Promise<void> {
  res.json(await proveedoresService.buscarProveedor(parseId(req.params.id)));
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const proveedor = await proveedoresService.crearProveedor(req.body as CrearProveedorInput);
  res.status(201).json(proveedor);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await proveedoresService.actualizarProveedor(id, req.body as ActualizarProveedorInput));
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  res.json(await proveedoresService.desactivarProveedor(parseId(req.params.id)));
}
