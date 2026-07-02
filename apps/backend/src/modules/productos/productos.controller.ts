import type { Request, Response } from "express";
import type {
  ActualizarProductoInput,
  ActualizarVarianteInput,
  CrearProductoInput,
  CrearVarianteInput,
} from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as productosService from "./productos.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await productosService.listarProductos());
}

export async function buscarPorIdController(req: Request, res: Response): Promise<void> {
  res.json(await productosService.buscarProducto(parseId(req.params.id)));
}

export async function buscarPorCodigoController(req: Request, res: Response): Promise<void> {
  res.json(await productosService.buscarProductoPorCodigo(req.params.codigo));
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const producto = await productosService.crearProducto(req.body as CrearProductoInput);
  res.status(201).json(producto);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await productosService.actualizarProducto(id, req.body as ActualizarProductoInput));
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  res.json(await productosService.desactivarProducto(parseId(req.params.id)));
}

export async function listarVariantesController(req: Request, res: Response): Promise<void> {
  const productoId = parseId(req.params.id);
  res.json(await productosService.listarVariantes(productoId));
}

export async function crearVarianteController(req: Request, res: Response): Promise<void> {
  const productoId = parseId(req.params.id);
  const variante = await productosService.crearVariante(
    productoId,
    req.body as CrearVarianteInput,
  );
  res.status(201).json(variante);
}

export async function actualizarVarianteController(req: Request, res: Response): Promise<void> {
  const varianteId = parseId(req.params.varianteId);
  const variante = await productosService.actualizarVariante(
    varianteId,
    req.body as ActualizarVarianteInput,
  );
  res.json(variante);
}

export async function desactivarVarianteController(req: Request, res: Response): Promise<void> {
  const varianteId = parseId(req.params.varianteId);
  res.json(await productosService.desactivarVariante(varianteId));
}
