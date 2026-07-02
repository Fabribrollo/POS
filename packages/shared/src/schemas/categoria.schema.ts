import { z } from "zod";

export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
});
export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;

export const actualizarCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarCategoriaInput = z.infer<typeof actualizarCategoriaSchema>;
