import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { NEGOCIO } from "../../core/config.js";

export function obtenerController(_req: Request, res: Response): void {
  res.json({
    nombre: NEGOCIO.nombre,
    direccion: NEGOCIO.direccion,
    cuit: NEGOCIO.cuit,
    // Relativo a la baseURL de la API (no al origen file:// de la app
    // empaquetada): el frontend lo arma con api.defaults.baseURL, igual que
    // cualquier otro request. No se expone la ruta de archivo real.
    logoUrl: NEGOCIO.logo ? "/negocio/logo" : null,
  });
}

export function logoController(_req: Request, res: Response): void {
  if (!NEGOCIO.logo || !fs.existsSync(NEGOCIO.logo)) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.resolve(NEGOCIO.logo));
}
