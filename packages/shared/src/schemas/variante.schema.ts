import { z } from "zod";

export const crearVarianteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"), // ej: "Talle M / Azul"
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  precioVenta: z.number().nonnegative().optional(),
});
export type CrearVarianteInput = z.infer<typeof crearVarianteSchema>;

export const actualizarVarianteSchema = z.object({
  nombre: z.string().min(1).optional(),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  precioVenta: z.number().nonnegative().optional(),
  activo: z.boolean().optional(),
});
export type ActualizarVarianteInput = z.infer<typeof actualizarVarianteSchema>;
