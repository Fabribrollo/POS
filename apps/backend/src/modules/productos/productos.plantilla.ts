import * as XLSX from "xlsx";

// Fila sin "variante" = producto nuevo. Fila con "producto" vacío y
// "variante" con texto = variante del producto de la fila de arriba.
// Ejemplo: "Remera básica" (producto) seguida de "Talle S" y "Talle M"
// (variantes, heredan categoría/marca/stock/costo del producto).
const FILAS_EJEMPLO = [
  {
    producto: "Remera básica",
    variante: "",
    categoria: "Remeras",
    marca: "Nike",
    stock: 20,
    precioCosto: 3000,
    precioVenta: 6000,
  },
  { producto: "", variante: "Talle S", categoria: "", marca: "", stock: "", precioCosto: "", precioVenta: 5900 },
  { producto: "", variante: "Talle M", categoria: "", marca: "", stock: "", precioCosto: "", precioVenta: "" },
  {
    producto: "Gorra",
    variante: "",
    categoria: "Accesorios",
    marca: "Adidas",
    stock: 10,
    precioCosto: 2000,
    precioVenta: 4500,
  },
];

const ENCABEZADOS = [
  "producto",
  "variante",
  "categoria",
  "marca",
  "stock",
  "precioCosto",
  "precioVenta",
];

export function generarPlantillaXlsx(): Buffer {
  const hoja = XLSX.utils.json_to_sheet(FILAS_EJEMPLO, { header: ENCABEZADOS });
  hoja["!cols"] = ENCABEZADOS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}
