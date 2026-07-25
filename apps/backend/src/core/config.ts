// En producción empaquetada, apps/electron/src/backend-bootstrap.ts siempre
// setea process.env.JWT_SECRET (un valor aleatorio generado en el primer
// arranque y persistido en userData) antes de que este módulo se importe.
// El fallback de acá solo debería usarse en desarrollo local sin .env — si
// aparece este warning con la app empaquetada, algo está mal.
if (!process.env.JWT_SECRET) {
  console.warn(
    "[config] JWT_SECRET no está seteado, usando un valor de desarrollo. " +
      "Esto NUNCA debe pasar en la app empaquetada.",
  );
}
export const JWT_SECRET = process.env.JWT_SECRET ?? "cambiar-en-produccion-DEV-ONLY";
export const JWT_EXPIRES_IN = "12h"; // dura un turno de trabajo

// Datos del local para el ticket de venta impreso. El ticket generado NO es
// una factura válida ante AFIP (no hay integración de facturación
// electrónica/CAE todavía), así que siempre se imprime con esa aclaración.
export const NEGOCIO = {
  nombre: process.env.NEGOCIO_NOMBRE ?? "POS Indumentaria",
  direccion: process.env.NEGOCIO_DIRECCION ?? "",
  cuit: process.env.NEGOCIO_CUIT ?? "",
};
