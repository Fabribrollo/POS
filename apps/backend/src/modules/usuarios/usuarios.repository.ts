import { prisma } from "../../core/prisma.js";

const selectSinPassword = {
  id: true,
  nombre: true,
  email: true,
  activo: true,
  ultimoLogin: true,
  createdAt: true,
  rol: { select: { id: true, nombre: true } },
} as const;

export function buscarRolPorNombre(nombre: string) {
  return prisma.rol.findUnique({ where: { nombre } });
}

export function buscarPorEmail(email: string) {
  return prisma.usuario.findUnique({ where: { email } });
}

export function buscarPorId(id: number) {
  return prisma.usuario.findUnique({ where: { id }, select: selectSinPassword });
}

export function listar() {
  return prisma.usuario.findMany({
    select: selectSinPassword,
    orderBy: { nombre: "asc" },
  });
}

export function crear(data: { nombre: string; email: string; passwordHash: string; rolId: number }) {
  return prisma.usuario.create({ data, select: selectSinPassword });
}

export function actualizar(
  id: number,
  data: { nombre?: string; rolId?: number; activo?: boolean },
) {
  return prisma.usuario.update({ where: { id }, data, select: selectSinPassword });
}
