import { z } from "zod";

function rangoValido(d: { desde?: Date; hasta?: Date }): boolean {
  return !d.desde || !d.hasta || d.desde <= d.hasta;
}

function mensajeRangoInvalido() {
  return { message: "La fecha 'desde' no puede ser posterior a 'hasta'", path: ["desde"] };
}

const rangoFechasBase = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

// El dashboard no pagina ni ordena, solo necesita el rango. Si no se manda
// desde/hasta, el service aplica el default (últimos 30 días).
export const rangoFechasQuerySchema = rangoFechasBase.refine(rangoValido, mensajeRangoInvalido());
export type RangoFechasQuery = z.infer<typeof rangoFechasQuerySchema>;

// Un solo schema para todos los endpoints de listado de reportes (ventas,
// caja, y los que se agreguen después): rango de fechas + paginación +
// búsqueda + orden.
export const reporteQuerySchema = rangoFechasBase
  .extend({
    pagina: z.coerce.number().int().positive().default(1),
    porPagina: z.coerce.number().int().positive().max(200).default(20),
    busqueda: z.string().trim().optional(),
    ordenarPor: z.string().optional(),
    direccion: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(rangoValido, mensajeRangoInvalido());
export type ReporteQuery = z.infer<typeof reporteQuerySchema>;

export const productosMasVendidosQuerySchema = rangoFechasBase
  .extend({ take: z.coerce.number().int().positive().max(100).default(10) })
  .refine(rangoValido, mensajeRangoInvalido());
export type ProductosMasVendidosQuery = z.infer<typeof productosMasVendidosQuerySchema>;

export const productosSinMovimientoQuerySchema = z.object({
  dias: z.coerce.number().int().positive().max(3650).default(30),
});
export type ProductosSinMovimientoQuery = z.infer<typeof productosSinMovimientoQuerySchema>;

// Inventario es una foto del stock actual: no tiene sentido de rango de
// fechas, solo paginación + búsqueda + orden.
export const paginacionQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(200).default(20),
  busqueda: z.string().trim().optional(),
  ordenarPor: z.string().optional(),
  direccion: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginacionQuery = z.infer<typeof paginacionQuerySchema>;
