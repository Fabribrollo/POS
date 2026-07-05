import { z } from "zod";

// nombre, sku y codigoBarras no se piden al usuario: se derivan de
// color/talle y del id autoincremental (ver nombreVariante y
// generarSkuVariante/generarCodigoBarrasVariante en el backend). El precio de
// una variante siempre es el del producto, no tiene override propio.
export const crearVarianteSchema = z.object({
  color: z.string().optional(),
  talle: z.string().optional(),
  stock: z.number().int().nonnegative(),
});
export type CrearVarianteInput = z.infer<typeof crearVarianteSchema>;

export const actualizarVarianteSchema = z.object({
  color: z.string().optional(),
  talle: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
});
export type ActualizarVarianteInput = z.infer<typeof actualizarVarianteSchema>;
