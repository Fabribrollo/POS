import { z } from "zod";

export const crearProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  cuit: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
});
export type CrearProveedorInput = z.infer<typeof crearProveedorSchema>;

export const actualizarProveedorSchema = z.object({
  nombre: z.string().min(1).optional(),
  cuit: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
  activo: z.boolean().optional(),
});
export type ActualizarProveedorInput = z.infer<typeof actualizarProveedorSchema>;
