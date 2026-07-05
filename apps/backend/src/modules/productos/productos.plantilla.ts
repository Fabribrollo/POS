import * as XLSX from "xlsx";

const ENCABEZADOS_PRODUCTOS = [
  "Código Producto",
  "Nombre",
  "Categoría",
  "Marca",
  "Precio Costo",
  "Precio Venta",
  "Descripción",
];

const FILAS_PRODUCTOS = [
  ["REM001", "Remera Básica", "Remeras", "Nike", 10000, 18000, "Remera de algodón"],
  ["ZAP001", "Zapatilla Air", "Calzado", "Nike", 50000, 78000, "Running"],
];

const ENCABEZADOS_VARIANTES = ["Código Producto", "Color", "Talle", "Stock"];

const FILAS_VARIANTES = [
  ["REM001", "Blanco", "S", 15],
  ["REM001", "Blanco", "M", 8],
  ["REM001", "Negro", "S", 5],
  ["REM001", "Negro", "M", 12],
  ["ZAP001", "Azul", "42", 3],
  ["ZAP001", "Azul", "43", 7],
];

function hojaConAnchoDeColumnas(encabezados: string[], filas: unknown[][]) {
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
  hoja["!cols"] = encabezados.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  return hoja;
}

export function generarPlantillaXlsx(): Buffer {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    hojaConAnchoDeColumnas(ENCABEZADOS_PRODUCTOS, FILAS_PRODUCTOS),
    "Productos",
  );
  XLSX.utils.book_append_sheet(
    libro,
    hojaConAnchoDeColumnas(ENCABEZADOS_VARIANTES, FILAS_VARIANTES),
    "Variantes",
  );
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}
