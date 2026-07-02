import type { Request, Response } from "express";
import type {
  ActualizarClienteInput,
  CrearClienteInput,
  MovimientoCuentaCorrienteInput,
} from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as clientesService from "./clientes.service.js";

export async function listarController(_req: Request, res: Response): Promise<void> {
  res.json(await clientesService.listarClientes());
}

export async function buscarController(req: Request, res: Response): Promise<void> {
  res.json(await clientesService.buscarCliente(parseId(req.params.id)));
}

export async function crearController(req: Request, res: Response): Promise<void> {
  const cliente = await clientesService.crearCliente(req.body as CrearClienteInput);
  res.status(201).json(cliente);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json(await clientesService.actualizarCliente(id, req.body as ActualizarClienteInput));
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  res.json(await clientesService.desactivarCliente(parseId(req.params.id)));
}

export async function historialComprasController(req: Request, res: Response): Promise<void> {
  res.json(await clientesService.historialCompras(parseId(req.params.id)));
}

export async function saldoCCController(req: Request, res: Response): Promise<void> {
  res.json(await clientesService.obtenerSaldoCC(parseId(req.params.id)));
}

export async function movimientosCCController(req: Request, res: Response): Promise<void> {
  res.json(await clientesService.listarMovimientosCC(parseId(req.params.id)));
}

export async function registrarMovimientoCCController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const movimiento = await clientesService.registrarMovimientoCC(
    id,
    req.body as MovimientoCuentaCorrienteInput,
  );
  res.status(201).json(movimiento);
}
