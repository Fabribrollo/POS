import { z } from "zod";
import { mensajeRangoInvalido, rangoFechasBase, rangoValido } from "./reportes.schema.js";

// Mismo query base que el resto de los reportes (rango de fechas + paginación
// + búsqueda + orden), con los filtros propios de auditoría encima.
export const auditoriaQuerySchema = rangoFechasBase
  .extend({
    pagina: z.coerce.number().int().positive().default(1),
    porPagina: z.coerce.number().int().positive().max(200).default(20),
    busqueda: z.string().trim().optional(),
    ordenarPor: z.string().optional(),
    direccion: z.enum(["asc", "desc"]).default("desc"),
    usuarioId: z.coerce.number().int().positive().optional(),
    entidad: z.string().optional(),
    accion: z.string().optional(),
  })
  .refine(rangoValido, mensajeRangoInvalido());
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
