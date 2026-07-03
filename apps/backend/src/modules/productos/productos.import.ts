import * as XLSX from "xlsx";
import * as categoriasRepository from "../categorias/categorias.repository.js";
import * as marcasRepository from "../marcas/marcas.repository.js";
import * as productosRepository from "./productos.repository.js";

export interface ResultadoImportacion {
  productosCreados: number;
  variantesCreadas: number;
  errores: { fila: number; motivo: string }[];
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function numero(valor: unknown, campo: string): number {
  const str = String(valor ?? "").trim();
  const n = Number(str.replace(",", "."));
  if (str === "" || Number.isNaN(n)) {
    throw new Error(`"${campo}" inválido: "${valor}"`);
  }
  return n;
}

// Une, sin distinguir mayúsculas/minúsculas, el nombre de la fila con una
// categoría/marca ya existente; si no hay coincidencia la crea. El mapa se va
// completando durante la importación para no crear duplicados entre filas.
async function resolverId(
  nombre: string,
  mapa: Map<string, number>,
  crear: (nombre: string) => Promise<{ id: number }>,
): Promise<number | undefined> {
  if (!nombre) return undefined;
  const clave = nombre.toLowerCase();
  const existente = mapa.get(clave);
  if (existente) return existente;
  const creada = await crear(nombre);
  mapa.set(clave, creada.id);
  return creada.id;
}

export async function importarDesdeCsv(contenido: string): Promise<ResultadoImportacion> {
  const libro = XLSX.read(contenido, { type: "string" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: false,
  });

  const categoriasPorNombre = new Map(
    (await categoriasRepository.listar()).map((c) => [c.nombre.toLowerCase(), c.id]),
  );
  const marcasPorNombre = new Map(
    (await marcasRepository.listar()).map((m) => [m.nombre.toLowerCase(), m.id]),
  );

  const resultado: ResultadoImportacion = { productosCreados: 0, variantesCreadas: 0, errores: [] };
  let productoActualId: number | null = null;

  for (let i = 0; i < filas.length; i++) {
    const numeroFila = i + 2; // fila 1 es el encabezado
    const fila = filas[i];
    const nombreProducto = texto(fila.producto);
    const nombreVariante = texto(fila.variante);

    try {
      if (nombreProducto) {
        const categoriaId = await resolverId(texto(fila.categoria), categoriasPorNombre, (n) =>
          categoriasRepository.crear(n),
        );
        const marcaId = await resolverId(texto(fila.marca), marcasPorNombre, (n) =>
          marcasRepository.crear(n),
        );
        const creado = await productosRepository.crear({
          nombre: nombreProducto,
          categoriaId,
          marcaId,
          precioCosto: numero(fila.precioCosto, "precioCosto"),
          precioVenta: numero(fila.precioVenta, "precioVenta"),
          stockMinimo: texto(fila.stock) ? numero(fila.stock, "stock") : 0,
        });
        productoActualId = creado.id;
        resultado.productosCreados++;
      } else if (nombreVariante) {
        if (!productoActualId) {
          throw new Error("Fila de variante sin un producto arriba en el archivo");
        }
        const precioVentaTexto = texto(fila.precioVenta);
        await productosRepository.crearVariante(productoActualId, {
          nombre: nombreVariante,
          precioVenta: precioVentaTexto ? numero(precioVentaTexto, "precioVenta") : undefined,
        });
        resultado.variantesCreadas++;
      }
      // filas completamente vacías (separadores visuales) se ignoran
    } catch (err) {
      resultado.errores.push({
        fila: numeroFila,
        motivo: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return resultado;
}
