import { PrismaClient } from "../../generated/prisma/index.js";

// Instancia única compartida por todos los repositories. En dev con
// `tsx watch`, evita crear una conexión nueva en cada reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalForPrisma.prisma = prisma;
}
