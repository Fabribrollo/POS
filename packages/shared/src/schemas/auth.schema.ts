import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, "La contraseña actual es obligatoria"),
  passwordNueva: z.string().min(6, "La contraseña nueva debe tener al menos 6 caracteres"),
});
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
