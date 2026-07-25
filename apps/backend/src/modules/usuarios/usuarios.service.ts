import bcrypt from "bcryptjs";
import type { ActualizarUsuarioInput, CrearUsuarioInput } from "@pos/shared";
import { ACCION_AUDITORIA, ENTIDAD_AUDITORIA } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { registrar } from "../auditoria/auditoria.service.js";
import * as usuariosRepository from "./usuarios.repository.js";

async function resolverRolId(nombreRol: string): Promise<number> {
  const rol = await usuariosRepository.buscarRolPorNombre(nombreRol);
  if (!rol) {
    throw new BusinessRuleError(`El rol ${nombreRol} no existe`);
  }
  return rol.id;
}

export async function crearUsuario(input: CrearUsuarioInput, usuarioId: number) {
  const existente = await usuariosRepository.buscarPorEmail(input.email);
  if (existente) {
    throw new BusinessRuleError("Ya existe un usuario con ese email");
  }

  const rolId = await resolverRolId(input.rol);
  const passwordHash = await bcrypt.hash(input.password, 10);

  const creado = await usuariosRepository.crear({
    nombre: input.nombre,
    email: input.email,
    passwordHash,
    rolId,
  });

  await registrar(prisma, {
    usuarioId,
    accion: ACCION_AUDITORIA.CREAR,
    entidad: ENTIDAD_AUDITORIA.USUARIO,
    entidadId: creado.id,
    detalle: { nombre: creado.nombre, email: creado.email, rol: input.rol },
  });

  return creado;
}

export function listarUsuarios() {
  return usuariosRepository.listar();
}

export async function actualizarUsuario(id: number, input: ActualizarUsuarioInput, usuarioId: number) {
  const usuario = await usuariosRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError("Usuario no encontrado");
  }

  const rolId = input.rol ? await resolverRolId(input.rol) : undefined;
  // Reseteo de contraseña por un administrador: se fuerza a que el usuario
  // afectado la cambie de nuevo en su próximo login (mismo gate que usa el
  // admin sembrado la primera vez).
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;

  const actualizado = await usuariosRepository.actualizar(id, {
    nombre: input.nombre,
    activo: input.activo,
    rolId,
    passwordHash,
    debeCambiarPassword: passwordHash ? true : undefined,
  });

  // Cambio de rol, de estado activo, o reseteo de contraseña son los campos
  // que de verdad importa poder auditar (escalada/degradación de
  // privilegios, alta/baja, credenciales tocadas por otro). Nunca se guarda
  // la contraseña en sí, solo el hecho de que se reseteó.
  const cambios: Record<string, unknown> = {};
  if (input.rol && input.rol !== usuario.rol.nombre) {
    cambios.rol = { antes: usuario.rol.nombre, despues: input.rol };
  }
  if (input.activo !== undefined && input.activo !== usuario.activo) {
    cambios.activo = { antes: usuario.activo, despues: input.activo };
  }
  if (passwordHash) {
    cambios.passwordReseteada = true;
  }
  if (Object.keys(cambios).length > 0) {
    await registrar(prisma, {
      usuarioId,
      accion: ACCION_AUDITORIA.ACTUALIZAR,
      entidad: ENTIDAD_AUDITORIA.USUARIO,
      entidadId: id,
      detalle: { afectado: usuario.nombre, ...cambios },
    });
  }

  return actualizado;
}

// Baja lógica: nunca se borra un usuario físicamente porque queda referenciado
// por ventas, movimientos de stock y de caja históricos.
export async function desactivarUsuario(id: number, usuarioId: number) {
  const usuario = await usuariosRepository.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError("Usuario no encontrado");
  }
  const actualizado = await usuariosRepository.actualizar(id, { activo: false });
  await registrar(prisma, {
    usuarioId,
    accion: ACCION_AUDITORIA.DESACTIVAR,
    entidad: ENTIDAD_AUDITORIA.USUARIO,
    entidadId: id,
    detalle: { afectado: usuario.nombre },
  });
  return actualizado;
}
