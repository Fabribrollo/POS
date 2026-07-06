export const JWT_SECRET = process.env.JWT_SECRET ?? "cambiar-en-produccion";
export const JWT_EXPIRES_IN = "12h"; // dura un turno de trabajo

// Datos del local para el ticket de venta impreso. El ticket generado NO es
// una factura válida ante AFIP (no hay integración de facturación
// electrónica/CAE todavía), así que siempre se imprime con esa aclaración.
export const NEGOCIO = {
  nombre: process.env.NEGOCIO_NOMBRE ?? "POS Indumentaria",
  direccion: process.env.NEGOCIO_DIRECCION ?? "",
  cuit: process.env.NEGOCIO_CUIT ?? "",
};
