import type { Request, Response } from "express";
import type { AbrirCajaInput, CerrarCajaInput, MovimientoCajaInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as cajaService from "./caja.service.js";

export async function abrirController(req: Request, res: Response): Promise<void> {
  const caja = await cajaService.abrirCaja(req.usuario!.id, req.body as AbrirCajaInput);
  res.status(201).json(caja);
}

export async function obtenerAbiertaController(_req: Request, res: Response): Promise<void> {
  res.json(await cajaService.obtenerCajaAbierta());
}

export async function cerrarController(req: Request, res: Response): Promise<void> {
  const caja = await cajaService.cerrarCaja(req.usuario!.id, req.body as CerrarCajaInput);
  res.json(caja);
}

export async function movimientoController(req: Request, res: Response): Promise<void> {
  const movimiento = await cajaService.registrarMovimientoManual(
    req.body as MovimientoCajaInput,
    req.usuario!.id,
  );
  res.status(201).json(movimiento);
}

export async function listarMovimientosController(req: Request, res: Response): Promise<void> {
  const cajaId = parseId(req.params.id);
  res.json(await cajaService.listarMovimientos(cajaId));
}

export async function historialController(_req: Request, res: Response): Promise<void> {
  res.json(await cajaService.listarHistorial());
}
