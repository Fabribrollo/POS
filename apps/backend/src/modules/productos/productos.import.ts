import * as XLSX from "xlsx";
import { TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";
import { ValidationError } from "../../core/errors/AppError.js";
import * as categoriasRepository from "../categorias/categorias.repository.js";
import * as marcasRepository from "../marcas/marcas.repository.js";
import { aplicarMovimientoStockTx, resolverDepositoId } from "../stock/stock.service.js";
import { nombreVariante } from "./productos.codigos.js";
import * as productosRepository from "./productos.repository.js";

export interface ErrorImportacion {
  hoja: "Productos" | "Variantes";
  fila: number;
  motivo: string;
}

export interface ResultadoImportacionExcel {
  importado: boolean;
  productosNuevos: number;
  variantesNuevas: number;
  errores: ErrorImportacion[];
}

interface FilaProducto {
  fila: number;
  codigoProducto: string;
  nombre: string;
  categoria: string;
  marca: string;
  precioCosto: number;
  precioVenta: number;
  descripcion: string;
}

interface FilaVariante {
  fila: number;
  codigoProducto: string;
  color: string;
  talle: string;
  stock: number;
}

const HOJA_PRODUCTOS = "Productos";
const HOJA_VARIANTES = "Variantes";

const COLUMNAS_PRODUCTOS: Record<string, string> = {
  "codigo producto": "codigoProducto",
  nombre: "nombre",
  categoria: "categoria",
  marca: "marca",
  "precio costo": "precioCosto",
  "precio venta": "precioVenta",
  descripcion: "descripcion",
};

const COLUMNAS_VARIANTES: Record<string, string> = {
  "codigo producto": "codigoProducto",
  color: "color",
  talle: "talle",
  stock: "stock",
};

// Sin tildes, en minúscula y con espacios colapsados: tolera que el usuario
// escriba "Código  Producto" o "CODIGO PRODUCTO" sin romper el mapeo de
// columnas.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function filaVacia(fila: unknown[]): boolean {
  return fila.every((celda) => texto(celda) === "");
}

// Lee una hoja como array-de-arrays (no como objetos) para no depender de que
// las keys que arma sheet_to_json coincidan literalmente con el encabezado:
// acá el encabezado se normaliza y se mapea a nombres de campo conocidos,
// columna por índice. Filas completamente vacías (relleno típico de Excel al
// final de una hoja) se descartan en silencio.
function leerFilas(
  libro: XLSX.WorkBook,
  nombreHoja: string,
  columnas: Record<string, string>,
): { fila: number; datos: Record<string, string> }[] {
  const hoja = libro.Sheets[nombreHoja];
  if (!hoja) {
    throw new ValidationError(`El archivo no tiene una hoja llamada "${nombreHoja}"`);
  }

  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: false });
  const [encabezado, ...resto] = filas;
  if (!encabezado) {
    throw new ValidationError(`La hoja "${nombreHoja}" está vacía`);
  }

  const indicePorCampo = new Map<string, number>();
  encabezado.forEach((valor, indice) => {
    const campo = columnas[normalizarEncabezado(valor)];
    if (campo) indicePorCampo.set(campo, indice);
  });

  const faltantes = Object.values(columnas).filter((campo) => !indicePorCampo.has(campo));
  if (faltantes.length) {
    throw new ValidationError(
      `A la hoja "${nombreHoja}" le faltan columnas obligatorias: ${faltantes.join(", ")}`,
    );
  }

  return resto
    .map((valores, indice) => ({ fila: indice + 2, valores }))
    .filter(({ valores }) => !filaVacia(valores))
    .map(({ fila, valores }) => {
      const datos: Record<string, string> = {};
      for (const [campo, columnaIndice] of indicePorCampo) {
        datos[campo] = texto(valores[columnaIndice]);
      }
      return { fila, datos };
    });
}

function numeroONulo(valor: string): number | null {
  if (valor === "") return null;
  const n = Number(valor.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function validarProductos(
  filas: { fila: number; datos: Record<string, string> }[],
  errores: ErrorImportacion[],
): FilaProducto[] {
  const productos: FilaProducto[] = [];
  const codigosVistos = new Set<string>();

  for (const { fila, datos } of filas) {
    const errorFila = (motivo: string) => errores.push({ hoja: "Productos", fila, motivo });
    const codigoProducto = datos.codigoProducto;

    if (!codigoProducto) {
      errorFila('"Código Producto" es obligatorio');
      continue;
    }
    if (codigosVistos.has(codigoProducto.toLowerCase())) {
      errorFila(`Código Producto "${codigoProducto}" está duplicado en la hoja Productos`);
      continue;
    }
    codigosVistos.add(codigoProducto.toLowerCase());

    if (!datos.nombre) {
      errorFila('"Nombre" es obligatorio');
      continue;
    }

    const precioCosto = numeroONulo(datos.precioCosto);
    if (precioCosto === null || precioCosto < 0) {
      errorFila(`"Precio Costo" inválido: "${datos.precioCosto}"`);
      continue;
    }
    const precioVenta = numeroONulo(datos.precioVenta);
    if (precioVenta === null || precioVenta < 0) {
      errorFila(`"Precio Venta" inválido: "${datos.precioVenta}"`);
      continue;
    }
    if (precioVenta < precioCosto) {
      errorFila('"Precio Venta" no puede ser menor a "Precio Costo"');
      continue;
    }

    productos.push({
      fila,
      codigoProducto,
      nombre: datos.nombre,
      categoria: datos.categoria,
      marca: datos.marca,
      precioCosto,
      precioVenta,
      descripcion: datos.descripcion,
    });
  }

  return productos;
}

function validarVariantes(
  filas: { fila: number; datos: Record<string, string> }[],
  productos: FilaProducto[],
  errores: ErrorImportacion[],
): FilaVariante[] {
  const codigosProducto = new Set(productos.map((p) => p.codigoProducto.toLowerCase()));
  const variantes: FilaVariante[] = [];
  const clavesVistas = new Set<string>();

  for (const { fila, datos } of filas) {
    const errorFila = (motivo: string) => errores.push({ hoja: "Variantes", fila, motivo });
    const codigoProducto = datos.codigoProducto;

    if (!codigoProducto) {
      errorFila('"Código Producto" es obligatorio');
      continue;
    }
    if (!codigosProducto.has(codigoProducto.toLowerCase())) {
      errorFila(`Código Producto "${codigoProducto}" no existe en la hoja Productos`);
      continue;
    }

    const stock = numeroONulo(datos.stock);
    if (stock === null || !Number.isInteger(stock) || stock < 0) {
      errorFila(`"Stock" inválido: "${datos.stock}" (debe ser un entero mayor o igual a cero)`);
      continue;
    }

    const clave = `${codigoProducto.toLowerCase()}|${datos.color.toLowerCase()}|${datos.talle.toLowerCase()}`;
    if (clavesVistas.has(clave)) {
      errorFila(
        `Variante duplicada para "${codigoProducto}" (mismo color/talle ya definido en otra fila)`,
      );
      continue;
    }
    clavesVistas.add(clave);

    variantes.push({ fila, codigoProducto, color: datos.color, talle: datos.talle, stock });
  }

  // Regla de negocio: todo producto tiene al menos una variante (aunque sea
  // "Único", con color y talle vacíos). El error se ancla en la fila del
  // producto en su propia hoja, porque no hay ninguna fila de Variantes a la
  // cual referenciar.
  for (const producto of productos) {
    const tieneVariante = variantes.some(
      (v) => v.codigoProducto.toLowerCase() === producto.codigoProducto.toLowerCase(),
    );
    if (!tieneVariante) {
      errores.push({
        hoja: "Productos",
        fila: producto.fila,
        motivo: `El producto "${producto.codigoProducto}" no tiene ninguna variante definida en la hoja Variantes`,
      });
    }
  }

  return variantes;
}

async function resolverCategoriaOMarcaId(
  tx: Prisma.TransactionClient,
  nombre: string,
  mapa: Map<string, number>,
  crear: (nombre: string, db: Prisma.TransactionClient) => Promise<{ id: number }>,
): Promise<number | undefined> {
  if (!nombre) return undefined;
  const clave = nombre.toLowerCase();
  const existente = mapa.get(clave);
  if (existente) return existente;
  const creada = await crear(nombre, tx);
  mapa.set(clave, creada.id);
  return creada.id;
}

export async function importarProductosExcel(
  archivoBase64: string,
  usuarioId: number,
): Promise<ResultadoImportacionExcel> {
  const libro = XLSX.read(archivoBase64, { type: "base64" });

  const filasProductos = leerFilas(libro, HOJA_PRODUCTOS, COLUMNAS_PRODUCTOS);
  const filasVariantes = leerFilas(libro, HOJA_VARIANTES, COLUMNAS_VARIANTES);

  const errores: ErrorImportacion[] = [];
  const productos = validarProductos(filasProductos, errores);
  const variantes = validarVariantes(filasVariantes, productos, errores);

  if (errores.length > 0) {
    return {
      importado: false,
      productosNuevos: productos.length,
      variantesNuevas: variantes.length,
      errores,
    };
  }

  const categoriasPorNombre = new Map(
    (await categoriasRepository.listar()).map((c) => [c.nombre.toLowerCase(), c.id]),
  );
  const marcasPorNombre = new Map(
    (await marcasRepository.listar()).map((m) => [m.nombre.toLowerCase(), m.id]),
  );
  const depositoId = await resolverDepositoId();

  await prisma.$transaction(async (tx) => {
    const productoPorCodigo = new Map<string, { id: number; codigoInterno: string }>();

    for (const p of productos) {
      const categoriaId = await resolverCategoriaOMarcaId(
        tx,
        p.categoria,
        categoriasPorNombre,
        categoriasRepository.crear,
      );
      const marcaId = await resolverCategoriaOMarcaId(
        tx,
        p.marca,
        marcasPorNombre,
        marcasRepository.crear,
      );

      const creado = await productosRepository.crearTx(tx, {
        nombre: p.nombre,
        descripcion: p.descripcion || undefined,
        categoriaId,
        marcaId,
        precioCosto: p.precioCosto,
        precioVenta: p.precioVenta,
        stockMinimo: 0,
      });
      productoPorCodigo.set(p.codigoProducto.toLowerCase(), {
        id: creado.id,
        codigoInterno: creado.codigoInterno,
      });
    }

    for (const v of variantes) {
      const producto = productoPorCodigo.get(v.codigoProducto.toLowerCase());
      if (!producto) continue; // no debería pasar: ya se validó contra `productos`

      const varianteCreada = await productosRepository.crearVarianteConCodigos(
        tx,
        producto.id,
        producto.codigoInterno,
        {
          nombre: nombreVariante(v.color, v.talle),
          color: v.color || undefined,
          talle: v.talle || undefined,
        },
      );

      await aplicarMovimientoStockTx(
        tx,
        { productoId: producto.id, varianteId: varianteCreada.id, depositoId, usuarioId },
        TIPO_MOVIMIENTO_STOCK.INGRESO,
        v.stock,
        "Importación desde Excel",
      );
    }
  });

  return {
    importado: true,
    productosNuevos: productos.length,
    variantesNuevas: variantes.length,
    errores: [],
  };
}
