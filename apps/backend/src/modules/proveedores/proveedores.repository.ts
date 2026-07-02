import { prisma } from "../../core/prisma.js";

export function listar() {
  return prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
}

export function buscarPorId(id: number) {
  return prisma.proveedor.findUnique({ where: { id } });
}

export function crear(data: {
  nombre: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}) {
  return prisma.proveedor.create({ data });
}

export function actualizar(id: number, data: Record<string, unknown>) {
  return prisma.proveedor.update({ where: { id }, data });
}
