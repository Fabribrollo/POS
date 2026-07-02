import { z } from "zod";

export const crearListaPrecioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
});
export type CrearListaPrecioInput = z.infer<typeof crearListaPrecioSchema>;

export const asignarPrecioSchema = z.object({
  productoId: z.number().int().positive(),
  listaPrecioId: z.number().int().positive(),
  precio: z.number().nonnegative(),
});
export type AsignarPrecioInput = z.infer<typeof asignarPrecioSchema>;
