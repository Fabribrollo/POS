import type { Request, Response } from "express";
import type { AnularVentaInput, CrearVentaInput } from "@pos/shared";
import { tienePermiso } from "@pos/shared";
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
  const estado = typeof req.query.estado === "string" ? req.query.estado : undefined;

  // Sin REPORTES_VER (p.ej. un vendedor) no se puede ver el listado completo
  // de ventas de todo el local: se fuerza a las propias, sin importar qué
  // usuarioId se haya pedido en la query.
  const puedeVerTodas = tienePermiso(req.usuario!.rol, "REPORTES_VER");
  const usuarioId = puedeVerTodas
    ? req.query.usuarioId
      ? Number(req.query.usuarioId)
      : undefined
    : req.usuario!.id;

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
