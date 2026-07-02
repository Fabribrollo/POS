import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.ts"],
    // Vitest inyecta esto en process.env de cada worker ANTES de cargar
    // cualquier archivo de test, así que core/prisma.ts (que construye el
    // PrismaClient al importarse) ve la URL correcta desde el primer momento.
    env: {
      DATABASE_URL: `file:${path.join(__dirname, "../../prisma/test.db")}`,
      JWT_SECRET: "test-secret",
    },
    fileParallelism: false, // todos los tests comparten una sola SQLite
    testTimeout: 15000,
  },
});
