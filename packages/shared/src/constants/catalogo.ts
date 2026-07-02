// Valores permitidos para los campos "String usados como enum" del schema
// (ver notas en prisma/schema.prisma). Validados acá con Zod y consumidos
// tanto por el backend (zod.parse en los DTOs) como por el frontend (selects,
// badges de estado).

export const MEDIOS_PAGO = {
  EFECTIVO: "EFECTIVO",
  DEBITO: "DEBITO",
  CREDITO: "CREDITO",
  TRANSFERENCIA: "TRANSFERENCIA",
  MERCADO_PAGO: "MERCADO_PAGO",
  QR: "QR",
} as const;
export type MedioPagoNombre = (typeof MEDIOS_PAGO)[keyof typeof MEDIOS_PAGO];

export const TIPO_MOVIMIENTO_STOCK = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
  AJUSTE: "AJUSTE",
  VENTA: "VENTA",
  DEVOLUCION: "DEVOLUCION",
  TRANSFERENCIA_SALIDA: "TRANSFERENCIA_SALIDA",
  TRANSFERENCIA_ENTRADA: "TRANSFERENCIA_ENTRADA",
  COMPRA: "COMPRA",
} as const;
export type TipoMovimientoStock =
  (typeof TIPO_MOVIMIENTO_STOCK)[keyof typeof TIPO_MOVIMIENTO_STOCK];

export const ESTADO_VENTA = {
  PENDIENTE: "PENDIENTE",
  COMPLETADA: "COMPLETADA",
  ANULADA: "ANULADA",
} as const;
export type EstadoVenta = (typeof ESTADO_VENTA)[keyof typeof ESTADO_VENTA];

export const ESTADO_CAJA = {
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA",
} as const;
export type EstadoCaja = (typeof ESTADO_CAJA)[keyof typeof ESTADO_CAJA];

export const TIPO_MOVIMIENTO_CAJA = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
  VENTA: "VENTA",
  RETIRO: "RETIRO",
  POZO_INICIAL: "POZO_INICIAL",
} as const;
export type TipoMovimientoCaja =
  (typeof TIPO_MOVIMIENTO_CAJA)[keyof typeof TIPO_MOVIMIENTO_CAJA];

export const TIPO_DEVOLUCION = {
  CAMBIO_PRODUCTO: "CAMBIO_PRODUCTO",
  CAMBIO_TALLE: "CAMBIO_TALLE",
  CAMBIO_OTRO_PRODUCTO: "CAMBIO_OTRO_PRODUCTO",
  REINTEGRO: "REINTEGRO",
  NOTA_CREDITO: "NOTA_CREDITO",
} as const;
export type TipoDevolucion = (typeof TIPO_DEVOLUCION)[keyof typeof TIPO_DEVOLUCION];
