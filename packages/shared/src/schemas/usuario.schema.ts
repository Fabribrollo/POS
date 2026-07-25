import { z } from "zod";
import { ROLES } from "../constants/roles.js";

const rolNombreEnum = z.enum([ROLES.ADMINISTRADOR, ROLES.ENCARGADO, ROLES.VENDEDOR]);

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol: rolNombreEnum,
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: rolNombreEnum.optional(),
  activo: z.boolean().optional(),
  // Reseteo de contraseña por un administrador (distinto del autoservicio de
  // POST /auth/cambiar-password). Al usarlo, se fuerza a que el usuario
  // afectado tenga que cambiarla de nuevo en su próximo login.
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
