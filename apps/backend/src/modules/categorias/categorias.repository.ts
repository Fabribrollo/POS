import { prisma } from "../../core/prisma.js";

export function listar() {
  return prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
}

export function buscarPorId(id: number) {
  return prisma.categoria.findUnique({ where: { id } });
}

export function buscarPorNombre(nombre: string) {
  return prisma.categoria.findUnique({ where: { nombre } });
}

export function crear(nombre: string) {
  return prisma.categoria.create({ data: { nombre } });
}

export function actualizar(id: number, data: { nombre?: string; activo?: boolean }) {
  return prisma.categoria.update({ where: { id }, data });
}
