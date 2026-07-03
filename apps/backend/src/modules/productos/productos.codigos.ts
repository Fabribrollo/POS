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
export function generarCodigoBarras(id: number): string {
  const base = `2${String(id).padStart(11, "0")}`;
  return `${base}${digitoVerificadorEan13(base)}`;
}

function digitoVerificadorEan13(doce: string): string {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    suma += Number(doce[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (suma % 10)) % 10);
}
