import { prisma } from "../../core/prisma.js";

export function listar() {
  return prisma.listaPrecio.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
}

export function buscarPorNombre(nombre: string) {
  return prisma.listaPrecio.findUnique({ where: { nombre } });
}

export function crear(nombre: string) {
  return prisma.listaPrecio.create({ data: { nombre } });
}

export function listarPreciosDeProducto(productoId: number) {
  return prisma.precioProducto.findMany({
    where: { productoId },
    include: { listaPrecio: true },
  });
}

export function asignarPrecio(productoId: number, listaPrecioId: number, precio: number) {
  return prisma.precioProducto.upsert({
    where: { productoId_listaPrecioId: { productoId, listaPrecioId } },
    update: { precio },
    create: { productoId, listaPrecioId, precio },
  });
}
