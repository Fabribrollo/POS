import { z } from "zod";

export const crearClienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  documento: z.string().optional(),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  limiteCuentaCorriente: z.number().nonnegative().optional(),
});
export type CrearClienteInput = z.infer<typeof crearClienteSchema>;

export const actualizarClienteSchema = z.object({
  nombre: z.string().min(1).optional(),
  documento: z.string().optional(),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  limiteCuentaCorriente: z.number().nonnegative().optional(),
  activo: z.boolean().optional(),
});
export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>;

export const movimientoCuentaCorrienteSchema = z.object({
  tipo: z.enum(["DEBITO", "CREDITO"]),
  monto: z.number().positive(),
});
export type MovimientoCuentaCorrienteInput = z.infer<typeof movimientoCuentaCorrienteSchema>;
