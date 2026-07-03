import { randomUUID } from "node:crypto";
import { prisma } from "../../core/prisma.js";
import { generarCodigoBarras, generarCodigoInterno } from "./productos.codigos.js";

const includeCatalogo = {
  categoria: true,
  marca: true,
  variantes: { where: { activo: true } },
} as const;

export function listar() {
  return prisma.producto.findMany({
    where: { activo: true },
    include: includeCatalogo,
    orderBy: { nombre: "asc" },
  });
}

export function buscarPorId(id: number) {
  return prisma.producto.findUnique({ where: { id }, include: includeCatalogo });
}

// Usado por el escaneo de código de barras y la búsqueda rápida del punto de
// venta: un mismo input puede ser código de barras, SKU o código interno.
export function buscarPorCodigo(codigo: string) {
  return prisma.producto.findFirst({
    where: {
      activo: true,
      OR: [{ codigoBarras: codigo }, { sku: codigo }, { codigoInterno: codigo }],
    },
    include: includeCatalogo,
  });
}

export function crear(data: {
  nombre: string;
  descripcion?: string;
  sku?: string;
  categoriaId?: number;
  marcaId?: number;
  precioCosto: number;
  precioVenta: number;
  stockMinimo: number;
}) {
  // codigoInterno y codigoBarras se derivan del id autoincremental, así que
  // el producto se crea primero con un placeholder único (para satisfacer el
  // NOT NULL) y se actualiza en la misma transacción ya con el id en mano.
  return prisma.$transaction(async (tx) => {
    const creado = await tx.producto.create({
      data: { ...data, codigoInterno: randomUUID() },
    });
    return tx.producto.update({
      where: { id: creado.id },
      data: {
        codigoInterno: generarCodigoInterno(creado.id),
        codigoBarras: generarCodigoBarras(creado.id),
      },
      include: includeCatalogo,
    });
  });
}

export function actualizar(id: number, data: Record<string, unknown>) {
  return prisma.producto.update({ where: { id }, data, include: includeCatalogo });
}

export function crearVariante(
  productoId: number,
  data: { nombre: string; sku?: string; codigoBarras?: string; precioVenta?: number },
) {
  return prisma.variante.create({ data: { ...data, productoId } });
}

export function listarVariantes(productoId: number) {
  return prisma.variante.findMany({ where: { productoId, activo: true } });
}

export function buscarVariantePorId(id: number) {
  return prisma.variante.findUnique({ where: { id } });
}

export function actualizarVariante(id: number, data: Record<string, unknown>) {
  return prisma.variante.update({ where: { id }, data });
}
