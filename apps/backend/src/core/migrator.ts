import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../generated/prisma/index.js";

// Migrador liviano para producción empaquetada: en vez de bundlear el CLI de
// Prisma (motor de migración nativo + ~100MB extra en el instalador), leemos
// los mismos prisma/migrations/*/migration.sql generados en desarrollo con
// `prisma migrate dev` y los aplicamos nosotros mismos con el propio
// PrismaClient vía $executeRawUnsafe. Solo necesitamos el motor de consultas
// (que ya viaja con @prisma/client), no el de migración.
//
// Registra lo aplicado en una tabla propia (no la `_prisma_migrations` de
// Prisma) para no depender del formato interno de su motor de migración.
export async function runMigrations(prisma: PrismaClient, migrationsDir: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_migraciones_aplicadas" (
      "nombre" TEXT NOT NULL PRIMARY KEY,
      "aplicada_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  const aplicadas = await prisma.$queryRawUnsafe<{ nombre: string }[]>(
    `SELECT nombre FROM "_migraciones_aplicadas"`,
  );
  const yaAplicadas = new Set(aplicadas.map((m) => m.nombre));

  const carpetas = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const carpeta of carpetas) {
    if (yaAplicadas.has(carpeta)) continue;

    const archivoSql = path.join(migrationsDir, carpeta, "migration.sql");
    const contenido = fs.readFileSync(archivoSql, "utf-8");

    const sentencias = contenido
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[migrator] aplicando ${carpeta} (${sentencias.length} sentencias)`);
    // Todo o nada: si una sentencia falla a mitad de camino, no queda DDL a
    // medio aplicar (SQLite sí soporta transacciones sobre DDL).
    await prisma.$transaction(async (tx) => {
      for (const sentencia of sentencias) {
        await tx.$executeRawUnsafe(sentencia);
      }
      await tx.$executeRaw`INSERT INTO "_migraciones_aplicadas" ("nombre") VALUES (${carpeta})`;
    });
  }
}
