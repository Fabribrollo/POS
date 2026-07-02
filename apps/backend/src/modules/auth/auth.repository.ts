import { prisma } from "../../core/prisma.js";

export function buscarUsuarioPorEmail(email: string) {
  return prisma.usuario.findUnique({
    where: { email },
    include: { rol: true },
  });
}

export function registrarUltimoLogin(usuarioId: number) {
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { ultimoLogin: new Date() },
  });
}
