const PREFIJO_CODIGO_INTERNO = "P";
const LARGO_SECUENCIA_INTERNO = 6;

// Generados a partir del id autoincremental del producto: al ser único por
// diseño de la base, dos productos nunca pueden terminar con el mismo
// código interno ni el mismo código de barras (no hace falta chequeo aparte).
export function generarCodigoInterno(id: number): string {
  return `${PREFIJO_CODIGO_INTERNO}${String(id).padStart(LARGO_SECUENCIA_INTERNO, "0")}`;
}

// EAN-13 de "uso interno": el prefijo "2" es el rango reservado internacionalmente
// para códigos que no vienen de fábrica (el mismo que usan supermercados para
// balanzas), así no choca con un código de barras real de un producto importado.
// Las variantes usan el prefijo "3" (ver generarCodigoBarrasVariante) para que
// su espacio numérico nunca se superponga con el de Producto, por si en el
// futuro el escaneo del punto de venta empieza a buscar en ambas tablas.
export function generarCodigoBarras(id: number, prefijo = "2"): string {
  const base = `${prefijo}${String(id).padStart(11, "0")}`;
  return `${base}${digitoVerificadorEan13(base)}`;
}

export function generarCodigoBarrasVariante(varianteId: number): string {
  return generarCodigoBarras(varianteId, "3");
}

// SKU legible que conserva trazabilidad al producto dueño de la variante.
export function generarSkuVariante(codigoInternoProducto: string, varianteId: number): string {
  return `${codigoInternoProducto}-${String(varianteId).padStart(6, "0")}`;
}

// El usuario nunca escribe el nombre de una variante: se deriva de color y
// talle (los únicos datos que distinguen una variante de otra).
export function nombreVariante(color?: string, talle?: string): string {
  const partes = [color, talle].filter(Boolean);
  return partes.length ? partes.join(" / ") : "Único";
}

function digitoVerificadorEan13(doce: string): string {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(doce[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (suma % 10)) % 10);
}
