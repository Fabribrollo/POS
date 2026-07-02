import type { Request, Response } from "express";
import type { LoginInput } from "@pos/shared";
import { login } from "./auth.service.js";

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await login(req.body as LoginInput);
  res.json(result);
}
