import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { CambiarPasswordInput, LoginInput, RolNombre } from "@pos/shared";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../core/config.js";
import { BusinessRuleError, NotFoundError, UnauthorizedError } from "../../core/errors/AppError.js";
import type { SesionUsuario } from "../../core/middlewares/authGuard.js";
import {
  actualizarPassword,
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  registrarUltimoLogin,
} from "./auth.repository.js";

interface LoginResult {
  token: string;
  usuario: SesionUsuario;
  // Aparte del payload del JWT (que no cambia hasta el próximo login): le
  // dice al frontend si tiene que mostrar el gate obligatorio de cambio de
  // contraseña antes de dejar entrar al resto de la app.
  debeCambiarPassword: boolean;
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

  return { token, usuario: sesion, debeCambiarPassword: usuario.debeCambiarPassword };
}

// Autoservicio: cualquier usuario autenticado puede cambiar su propia
// contraseña (no requiere el permiso de administración de usuarios). Es el
// mismo endpoint que resuelve el gate obligatorio del admin sembrado y
// también sirve como cambio de contraseña voluntario en cualquier momento.
export async function cambiarPassword(usuarioId: number, input: CambiarPasswordInput): Promise<void> {
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario) throw new NotFoundError("Usuario no encontrado");

  const passwordValida = await bcrypt.compare(input.passwordActual, usuario.passwordHash);
  if (!passwordValida) {
    throw new BusinessRuleError("La contraseña actual no es correcta");
  }

  const passwordHash = await bcrypt.hash(input.passwordNueva, 10);
  await actualizarPassword(usuarioId, passwordHash);
}
