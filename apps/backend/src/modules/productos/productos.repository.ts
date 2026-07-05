import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";
import {
  generarCodigoBarras,
  generarCodigoBarrasVariante,
  generarCodigoInterno,
  generarSkuVariante,
} from "./productos.codigos.js";

type Db = PrismaClient | Prisma.TransactionClient;

const includeCatalogo = {
  categoria: true,
  marca: true,
  variantes: { where: { activo: true }, include: { stock: true } },
  stock: true,
} as const;

function sumarStock(stock: { cantidad: number }[]): number {
  return stock.reduce((acc, s) => acc + s.cantidad, 0);
}

// El "stock" de un producto (y el de cada una de sus variantes) no es un
// campo propio: es la suma de todo lo cargado en Stock. Se calcula acá para
// no tener que pedirlo aparte a /stock/producto/:id, y para que el punto de
// venta pueda validar cantidad-vs-stock disponible sin otra consulta.
function conStockTotal<
  T extends { stock: { cantidad: number }[]; variantes: { stock: { cantidad: number }[] }[] },
>(producto: T) {
  const { stock, variantes, ...resto } = producto;
  return {
    ...resto,
    stockTotal: sumarStock(stock),
    variantes: variantes.map(({ stock: stockVariante, ...restoVariante }) => ({
      ...restoVariante,
      stock: sumarStock(stockVariante),
    })),
  };
}

export async function listar() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: includeCatalogo,
    orderBy: { nombre: "asc" },
  });
  return productos.map(conStockTotal);
}

export async function buscarPorId(id: number) {
  const producto = await prisma.producto.findUnique({ where: { id }, include: includeCatalogo });
  return producto ? conStockTotal(producto) : null;
}

// Usado por el escaneo de código de barras y la búsqueda rápida del punto de
// venta: un mismo input puede ser código de barras, SKU o código interno.
export async function buscarPorCodigo(codigo: string) {
  const producto = await prisma.producto.findFirst({
    where: {
      activo: true,
      OR: [{ codigoBarras: codigo }, { sku: codigo }, { codigoInterno: codigo }],
    },
    include: includeCatalogo,
  });
  return producto ? conStockTotal(producto) : null;
}

interface DatosProducto {
  nombre: string;
  descripcion?: string;
  sku?: string;
  categoriaId?: number;
  marcaId?: number;
  precioCosto: number;
  precioVenta: number;
  stockMinimo: number;
}

// codigoInterno y codigoBarras se derivan del id autoincremental, así que el
// producto se crea primero con un placeholder único (para satisfacer el
// NOT NULL) y se actualiza ya con el id en mano. Recibe `db` (prisma o un
// `tx`) para poder usarse tanto suelta como dentro de una transacción más
// grande (p.ej. la importación masiva, que crea muchos productos a la vez).
export async function crearTx(db: Db, data: DatosProducto) {
  const creado = await db.producto.create({
    data: { ...data, codigoInterno: randomUUID() },
  });
  return db.producto.update({
    where: { id: creado.id },
    data: {
      codigoInterno: generarCodigoInterno(creado.id),
      codigoBarras: generarCodigoBarras(creado.id),
    },
    include: includeCatalogo,
  });
}

export async function crear(data: DatosProducto) {
  const creado = await prisma.$transaction((tx) => crearTx(tx, data));
  return conStockTotal(creado);
}

export async function actualizar(id: number, data: Record<string, unknown>) {
  const actualizado = await prisma.producto.update({ where: { id }, data, include: includeCatalogo });
  return conStockTotal(actualizado);
}

// Variante dada de alta (por importación o manualmente): sku y codigoBarras
// siempre se derivan del id autoincremental (mismo esquema create-then-update
// que crearTx), nunca vienen del usuario ni del archivo.
export async function crearVarianteConCodigos(
  db: Db,
  productoId: number,
  codigoInternoProducto: string,
  data: { nombre: string; color?: string; talle?: string },
) {
  const creada = await db.variante.create({ data: { ...data, productoId } });
  return db.variante.update({
    where: { id: creada.id },
    data: {
      sku: generarSkuVariante(codigoInternoProducto, creada.id),
      codigoBarras: generarCodigoBarrasVariante(creada.id),
    },
  });
}

// El stock de cada variante también se calcula sumando Stock (no es un campo
// propio de Variante), igual que conStockTotal para el producto.
export async function listarVariantes(productoId: number) {
  const variantes = await prisma.variante.findMany({
    where: { productoId, activo: true },
    include: { stock: true },
  });
  return variantes.map(({ stock, ...resto }) => ({ ...resto, stock: sumarStock(stock) }));
}

export function buscarVariantePorId(id: number) {
  return prisma.variante.findUnique({ where: { id } });
}

// Búsqueda por escaneo del lado de la variante: mismo criterio que
// buscarPorCodigo pero sobre Variante (codigoBarras/sku), usado para que el
// punto de venta identifique la variante exacta antes que el producto. Trae
// el stock calculado para que el carrito pueda validar contra el disponible.
export async function buscarVariantePorCodigo(codigo: string) {
  const variante = await prisma.variante.findFirst({
    where: { activo: true, OR: [{ codigoBarras: codigo }, { sku: codigo }] },
    include: { stock: true },
  });
  if (!variante) return null;
  const { stock, ...resto } = variante;
  return { ...resto, stock: sumarStock(stock) };
}

export function actualizarVariante(id: number, data: Record<string, unknown>) {
  return prisma.variante.update({ where: { id }, data });
}
