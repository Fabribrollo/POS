import { z } from "zod";

export const crearProductoSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es obligatorio"),
    descripcion: z.string().optional(),
    sku: z.string().optional(),
    categoriaId: z.number().int().positive().optional(),
    marcaId: z.number().int().positive().optional(),
    precioCosto: z.number().nonnegative(),
    precioVenta: z.number().nonnegative(),
    stockMinimo: z.number().int().nonnegative().default(0),
  })
  .refine((data) => data.precioVenta >= data.precioCosto, {
    message: "El precio de venta no puede ser menor al precio de costo",
    path: ["precioVenta"],
  });

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;

export const actualizarProductoSchema = crearProductoSchema.innerType().partial();
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;

export const importarProductosSchema = z.object({
  contenido: z.string().min(1, "El archivo está vacío"),
});
export type ImportarProductosInput = z.infer<typeof importarProductosSchema>;
