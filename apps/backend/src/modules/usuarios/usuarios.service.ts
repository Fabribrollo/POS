import bcrypt from "bcryptjs";
import type { ActualizarUsuarioInput, CrearUsuarioInput } from "@pos/shared";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as usuariosRepository from "./usuarios.repository.js";

async function resolverRolId(nombreRol: string): Promise<number> {
  const rol = await usuariosRepository.buscarRolPorNombre(nombreRol);
  if (!rol) {
    throw new BusinessRuleError(`El rol ${nombreRol} no existe`);
  }
  return rol.id;
}

export async function crearUsuario(input: CrearUsuarioInput) {
  const existente = await usuariosRepository.buscarPorEmail(input.email);
  if (existente) {
    throw new BusinessRuleError("Ya existe un usuario con ese email");
  }

  const rolId = await resolverRolId(input.rol);
  const passwordHash = await bcrypt.hash(input.password, 10);

  return usuariosRepository.crear({
    nombre: input.nombre,
    email: input.email,
    passwordHash,
    rolId,
  });
}

export function listarUsuarios() {
  return usuariosRepository.listar();
}

export async function actualizarUsuario(id: number, input: ActualizarUsuarioInput) {
  const usuario = await usuariosRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError("Usuario no encontrado");
  }

  const rolId = input.rol ? await resolverRolId(input.rol) : undefined;

  return usuariosRepository.actualizar(id, {
    nombre: input.nombre,
    activo: input.activo,
    rolId,
  });
}

// Baja lógica: nunca se borra un usuario físicamente porque queda referenciado
// por ventas, movimientos de stock y de caja históricos.
export async function desactivarUsuario(id: number) {
  const usuario = await usuariosRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError("Usuario no encontrado");
  }
  return usuariosRepository.actualizar(id, { activo: false });
}
