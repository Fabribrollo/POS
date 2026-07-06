import { z } from "zod";
import { MEDIOS_PAGO } from "../constants/catalogo.js";

const medioPagoEnum = z.enum([
  MEDIOS_PAGO.EFECTIVO,
  MEDIOS_PAGO.DEBITO,
  MEDIOS_PAGO.CREDITO,
  MEDIOS_PAGO.TRANSFERENCIA,
  MEDIOS_PAGO.MERCADO_PAGO,
  MEDIOS_PAGO.QR,
  MEDIOS_PAGO.SALDO_A_FAVOR,
]);

export const itemVentaSchema = z.object({
  productoId: z.number().int().positive(),
  varianteId: z.number().int().positive().optional(),
  cantidad: z.number().int().positive(),
  precioUnitario: z.number().nonnegative(),
  descuento: z.number().nonnegative().default(0),
});

export const pagoVentaSchema = z.object({
  medioPago: medioPagoEnum,
  monto: z.number().positive(),
  cuotas: z.number().int().positive().optional(),
  recargo: z.number().nonnegative().default(0),
  referencia: z.string().optional(),
});

export const crearVentaSchema = z.object({
  clienteId: z.number().int().positive().optional(),
  items: z.array(itemVentaSchema).min(1, "La venta debe tener al menos un ítem"),
  descuentoTotal: z.number().nonnegative().default(0),
  pagos: z.array(pagoVentaSchema).min(1, "La venta debe tener al menos un pago"),
});
export type CrearVentaInput = z.infer<typeof crearVentaSchema>;

export const anularVentaSchema = z.object({
  motivo: z.string().min(1, "El motivo de anulación es obligatorio"),
});
export type AnularVentaInput = z.infer<typeof anularVentaSchema>;
