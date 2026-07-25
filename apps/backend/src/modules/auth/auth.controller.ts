import type { Request, Response } from "express";
import type { CambiarPasswordInput, LoginInput } from "@pos/shared";
import { cambiarPassword, login } from "./auth.service.js";

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await login(req.body as LoginInput);
  res.json(result);
}

export async function cambiarPasswordController(req: Request, res: Response): Promise<void> {
  await cambiarPassword(req.usuario!.id, req.body as CambiarPasswordInput);
  res.status(204).send();
}
