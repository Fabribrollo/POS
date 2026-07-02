import { z } from "zod";

const movimientoBase = {
  productoId: z.number().int().positive(),
  varianteId: z.number().int().positive().optional(),
  depositoId: z.number().int().positive().optional(), // si no se indica, se usa el depósito principal
};

export const ingresoStockSchema = z.object({
  ...movimientoBase,
  cantidad: z.number().int().positive(),
  motivo: z.string().optional(),
});
export type IngresoStockInput = z.infer<typeof ingresoStockSchema>;

export const egresoStockSchema = z.object({
  ...movimientoBase,
  cantidad: z.number().int().positive(),
  motivo: z.string().optional(),
});
export type EgresoStockInput = z.infer<typeof egresoStockSchema>;

export const ajusteStockSchema = z.object({
  ...movimientoBase,
  cantidadNueva: z.number().int().nonnegative(),
  motivo: z.string().min(1, "El motivo es obligatorio en un ajuste de inventario"),
});
export type AjusteStockInput = z.infer<typeof ajusteStockSchema>;
