import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../generated/prisma/index.js";

// Lista las carpetas de migración que todavía no están registradas en
// "_migraciones_aplicadas". Si la tabla ni siquiera existe todavía (primer
// arranque de la app, nunca se migró nada), se consideran todas pendientes.
// Se expone aparte de runMigrations para que otros módulos (el backup
// automático) puedan preguntar "¿hay una actualización de esquema por
// aplicar?" sin duplicar esta lógica ni disparar la migración en sí.
export async function migracionesPendientes(
  prisma: PrismaClient,
  migrationsDir: string,
): Promise<string[]> {
  const carpetas = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const tabla = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='_migraciones_aplicadas'`,
  );
  if (tabla.length === 0) return carpetas;

  const aplicadas = await prisma.$queryRawUnsafe<{ nombre: string }[]>(
    `SELECT nombre FROM "_migraciones_aplicadas"`,
  );
  const yaAplicadas = new Set(aplicadas.map((m) => m.nombre));
  return carpetas.filter((c) => !yaAplicadas.has(c));
}

// Elimina comentarios de línea ("-- ...") antes de partir el archivo por
// ";": este migrador no parsea SQL de verdad, solo separa por ese carácter,
// y un comentario con un punto y coma adentro (algo tan común como una
// aclaración en prosa) rompía el split a la mitad de una sentencia. No cubre
// un "--" dentro de un string literal (no pasa en ninguna migración de este
// proyecto), pero sí el caso real que importa: comentarios de migración.
function quitarComentarios(sql: string): string {
  return sql
    .split("\n")
    .map((linea) => {
      const inicio = linea.indexOf("--");
      return inicio === -1 ? linea : linea.slice(0, inicio);
    })
    .join("\n");
}

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
  const pendientes = await migracionesPendientes(prisma, migrationsDir);
  if (pendientes.length === 0) return;

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_migraciones_aplicadas" (
      "nombre" TEXT NOT NULL PRIMARY KEY,
      "aplicada_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  for (const carpeta of pendientes) {
    const archivoSql = path.join(migrationsDir, carpeta, "migration.sql");
    const contenido = fs.readFileSync(archivoSql, "utf-8");

    const sentencias = quitarComentarios(contenido)
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
