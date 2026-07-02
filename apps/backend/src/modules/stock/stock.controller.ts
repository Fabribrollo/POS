import type { Request, Response } from "express";
import type { AjusteStockInput, EgresoStockInput, IngresoStockInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as stockService from "./stock.service.js";

export async function ingresoController(req: Request, res: Response): Promise<void> {
  const movimiento = await stockService.registrarIngreso(
    req.body as IngresoStockInput,
    req.usuario!.id,
  );
  res.status(201).json(movimiento);
}

export async function egresoController(req: Request, res: Response): Promise<void> {
  const movimiento = await stockService.registrarEgreso(
    req.body as EgresoStockInput,
    req.usuario!.id,
  );
  res.status(201).json(movimiento);
}

export async function ajusteController(req: Request, res: Response): Promise<void> {
  const movimiento = await stockService.registrarAjuste(
    req.body as AjusteStockInput,
    req.usuario!.id,
  );
  res.status(201).json(movimiento);
}

export async function listarMovimientosController(req: Request, res: Response): Promise<void> {
  const productoId = req.query.productoId ? Number(req.query.productoId) : undefined;
  const tipo = typeof req.query.tipo === "string" ? req.query.tipo : undefined;
  res.json(await stockService.listarMovimientos({ productoId, tipo }));
}

export async function stockDeProductoController(req: Request, res: Response): Promise<void> {
  const productoId = parseId(req.params.productoId);
  res.json(await stockService.listarStockDeProducto(productoId));
}

export async function stockBajoController(_req: Request, res: Response): Promise<void> {
  res.json(await stockService.listarStockBajo());
}
