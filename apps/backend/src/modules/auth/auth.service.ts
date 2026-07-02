import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { LoginInput, RolNombre } from "@pos/shared";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../core/config.js";
import { UnauthorizedError } from "../../core/errors/AppError.js";
import type { SesionUsuario } from "../../core/middlewares/authGuard.js";
import { buscarUsuarioPorEmail, registrarUltimoLogin } from "./auth.repository.js";

interface LoginResult {
  token: string;
  usuario: SesionUsuario;
}

export async function login({ email, password }: LoginInput): Promise<LoginResult> {
  const usuario = await buscarUsuarioPorEmail(email);

  // Mismo mensaje para "no existe" y "password incorrecta": no darle a un
  // atacante información sobre qué emails están registrados en el sistema.
  if (!usuario || !usuario.activo) {
    throw new UnauthorizedError("Credenciales inválidas");
  }

  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValida) {
    throw new UnauthorizedError("Credenciales inválidas");
  }

  await registrarUltimoLogin(usuario.id);

  const sesion: SesionUsuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol.nombre as RolNombre,
  };

  const token = jwt.sign(sesion, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return { token, usuario: sesion };
}
