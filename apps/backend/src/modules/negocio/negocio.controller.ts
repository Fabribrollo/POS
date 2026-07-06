import type { Request, Response } from "express";
import { NEGOCIO } from "../../core/config.js";

export function obtenerController(_req: Request, res: Response): void {
  res.json(NEGOCIO);
}
