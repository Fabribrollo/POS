import { z } from "zod";

export const itemCompraSchema = z.object({
  productoId: z.number().int().positive(),
  varianteId: z.number().int().positive().optional(),
  cantidad: z.number().int().positive(),
  precioUnitario: z.number().nonnegative(),
});

export const crearCompraSchema = z.object({
  proveedorId: z.number().int().positive(),
  items: z.array(itemCompraSchema).min(1, "La compra debe tener al menos un ítem"),
});
export type CrearCompraInput = z.infer<typeof crearCompraSchema>;
