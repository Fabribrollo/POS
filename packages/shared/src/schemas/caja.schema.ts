import { z } from "zod";

export const abrirCajaSchema = z.object({
  montoApertura: z.number().nonnegative(),
});
export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;

export const cerrarCajaSchema = z.object({
  montoCierreDeclarado: z.number().nonnegative(),
  observaciones: z.string().optional(),
});
export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;

export const movimientoCajaSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  monto: z.number().positive(),
  concepto: z.string().min(1, "El concepto es obligatorio"),
});
export type MovimientoCajaInput = z.infer<typeof movimientoCajaSchema>;
