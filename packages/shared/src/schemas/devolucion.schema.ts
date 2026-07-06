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
  // Solo se usa cuando la venta original no tiene cliente asociado y el tipo
  // es NOTA_CREDITO: no hay cuenta corriente sin cliente, así que hay que
  // indicar a cuál acreditarle el saldo (se crea antes de esta llamada).
  clienteId: z.number().int().positive().optional(),
  items: z.array(itemDevolucionSchema).min(1, "La devolución debe tener al menos un ítem"),
});
export type CrearDevolucionInput = z.infer<typeof crearDevolucionSchema>;
