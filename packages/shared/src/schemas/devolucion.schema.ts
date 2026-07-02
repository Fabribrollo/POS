import { z } from "zod";
import { TIPO_DEVOLUCION } from "../constants/catalogo.js";

const tipoDevolucionEnum = z.enum([
  TIPO_DEVOLUCION.CAMBIO_PRODUCTO,
  TIPO_DEVOLUCION.CAMBIO_TALLE,
  TIPO_DEVOLUCION.CAMBIO_OTRO_PRODUCTO,
  TIPO_DEVOLUCION.REINTEGRO,
  TIPO_DEVOLUCION.NOTA_CREDITO,
]);

export const itemDevolucionSchema = z.object({
  itemVentaId: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  productoNuevoId: z.number().int().positive().optional(),
  varianteNuevaId: z.number().int().positive().optional(),
});

export const crearDevolucionSchema = z.object({
  ventaOriginalId: z.number().int().positive(),
  tipo: tipoDevolucionEnum,
  motivo: z.string().optional(),
  montoReintegro: z.number().default(0), // positivo: se le devuelve al cliente; negativo: paga la diferencia
  items: z.array(itemDevolucionSchema).min(1, "La devolución debe tener al menos un ítem"),
});
export type CrearDevolucionInput = z.infer<typeof crearDevolucionSchema>;
