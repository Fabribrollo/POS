// Import directo al código fuente (no al paquete @pos/backend compilado):
// este script lo corre `prisma migrate dev` en cada migración local, y no
// queremos forzar un build de @pos/backend antes de poder seedear en dev.
import { seedInicial } from "../apps/backend/src/core/seed.js";
import { prisma } from "../apps/backend/src/core/prisma.js";

seedInicial()
  .then(() => {
    console.log("Seed completado. Usuario admin: admin@pos.local / password: admin123");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
