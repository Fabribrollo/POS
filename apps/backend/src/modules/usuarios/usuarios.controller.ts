import type { Request, Response } from "express";
import type { ActualizarUsuarioInput, CrearUsuarioInput } from "@pos/shared";
import { parseId } from "../../core/utils/parseId.js";
import * as usuariosService from "./usuarios.service.js";

export async function crearController(req: Request, res: Response): Promise<void> {
  const usuario = await usuariosService.crearUsuario(req.body as CrearUsuarioInput);
  res.status(201).json(usuario);
}

export async function listarController(_req: Request, res: Response): Promise<void> {
  const usuarios = await usuariosService.listarUsuarios();
  res.json(usuarios);
}

export async function actualizarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const usuario = await usuariosService.actualizarUsuario(id, req.body as ActualizarUsuarioInput);
  res.json(usuario);
}

export async function desactivarController(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const usuario = await usuariosService.desactivarUsuario(id);
  res.json(usuario);
}
