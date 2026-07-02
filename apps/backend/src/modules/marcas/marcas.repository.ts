import { prisma } from "../../core/prisma.js";

export function listar() {
  return prisma.marca.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
}

export function buscarPorId(id: number) {
  return prisma.marca.findUnique({ where: { id } });
}

export function buscarPorNombre(nombre: string) {
  return prisma.marca.findUnique({ where: { nombre } });
}

export function crear(nombre: string) {
  return prisma.marca.create({ data: { nombre } });
}

export function actualizar(id: number, data: { nombre?: string; activo?: boolean }) {
  return prisma.marca.update({ where: { id }, data });
}
