import { z } from "zod";

export const crearMarcaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
});
export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;

export const actualizarMarcaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarMarcaInput = z.infer<typeof actualizarMarcaSchema>;
