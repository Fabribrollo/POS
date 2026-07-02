import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, "../../../prisma/test.db");

export async function setup(): Promise<void> {
  // Empezar siempre desde cero: una corrida de tests no debe depender de
  // datos que dejó la corrida anterior.
  fs.rmSync(testDbPath, { force: true });
  process.env.DATABASE_URL = `file:${testDbPath}`;

  // Import dinámico A PROPÓSITO (mismo motivo que en electron/backend-bootstrap.ts):
  // @prisma/client autocarga el .env del repo al importarse, así que un
  // import estático de estos módulos se evaluaría antes de que la línea de
  // arriba fije el DATABASE_URL de test.
  const { runMigrations, seedInicial, prisma } = await import("../src/index.js");

  await runMigrations(prisma, path.join(__dirname, "../../../prisma/migrations"));
  await seedInicial();
  await prisma.$disconnect();
}
