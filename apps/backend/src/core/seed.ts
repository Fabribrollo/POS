import bcrypt from "bcryptjs";
import { MEDIOS_PAGO, ROLES } from "@pos/shared";
import { prisma } from "./prisma.js";

// Idempotente (upsert): se puede llamar en cada arranque de Electron sin
// riesgo de duplicar datos. Es lo mínimo para que el sistema sea usable la
// primera vez que se abre la app instalada, sin intervención manual.
export async function seedInicial(): Promise<void> {
  const roles = await Promise.all(
    Object.values(ROLES).map((nombre) =>
      prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } }),
    ),
  );
  const rolAdmin = roles.find((r) => r.nombre === ROLES.ADMINISTRADOR)!;

  await Promise.all(
    Object.values(MEDIOS_PAGO).map((nombre) =>
      prisma.medioPago.upsert({ where: { nombre }, update: {}, create: { nombre } }),
    ),
  );

  await prisma.deposito.upsert({
    where: { nombre: "Depósito Central" },
    update: {},
    create: { nombre: "Depósito Central", principal: true },
  });

  const adminEmail = "admin@pos.local";
  const existeAdmin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
  if (!existeAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.usuario.create({
      data: { nombre: "Administrador", email: adminEmail, passwordHash, rolId: rolAdmin.id },
    });
  }
}
