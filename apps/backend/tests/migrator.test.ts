import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma/index.js";
import { runMigrations } from "../src/core/migrator.js";

let tmpDir: string;
let dbPath: string;
let prisma: PrismaClient;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-migrator-test-"));
  dbPath = path.join(tmpDir, "scratch.db");
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
});

afterEach(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function crearMigracion(nombre: string, sql: string): void {
  const carpeta = path.join(tmpDir, "migrations", nombre);
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, "migration.sql"), sql);
}

describe("migrator", () => {
  it("aplica una migración normal, sin comentarios raros", async () => {
    crearMigracion(
      "20260101000000_inicial",
      `CREATE TABLE "Cosa" ("id" INTEGER NOT NULL PRIMARY KEY);`,
    );

    await runMigrations(prisma, path.join(tmpDir, "migrations"));

    const filas = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='Cosa'`,
    );
    expect(filas).toHaveLength(1);
  });

  // Regresión: un comentario de migración con un punto y coma adentro (algo
  // tan normal como una aclaración en prosa) rompía el split ingenuo por ";"
  // a mitad de una sentencia real, tirando un error de sintaxis SQL.
  it("no se rompe con un punto y coma dentro de un comentario de línea", async () => {
    crearMigracion(
      "20260101000000_con_comentario_raro",
      [
        "-- AlterTable",
        'CREATE TABLE "Cosa" ("id" INTEGER NOT NULL PRIMARY KEY, "extra" BOOLEAN);',
        "",
        "-- Nota: esto es antes; esto es después (un comentario con ; adentro)",
        'UPDATE "Cosa" SET "extra" = true WHERE "id" = 1;',
        "",
        "-- CreateIndex",
        'CREATE UNIQUE INDEX "Cosa_extra_key" ON "Cosa"("extra");',
      ].join("\n"),
    );

    await expect(runMigrations(prisma, path.join(tmpDir, "migrations"))).resolves.not.toThrow();

    const filas = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='index' AND name='Cosa_extra_key'`,
    );
    expect(filas).toHaveLength(1);
  });

  it("es idempotente: correrla dos veces no reaplica la misma migración", async () => {
    crearMigracion(
      "20260101000000_idempotente",
      `CREATE TABLE "Cosa" ("id" INTEGER NOT NULL PRIMARY KEY);`,
    );
    const migrationsDir = path.join(tmpDir, "migrations");

    await runMigrations(prisma, migrationsDir);
    await expect(runMigrations(prisma, migrationsDir)).resolves.not.toThrow();

    const aplicadas = await prisma.$queryRawUnsafe<{ nombre: string }[]>(
      `SELECT nombre FROM "_migraciones_aplicadas"`,
    );
    expect(aplicadas).toHaveLength(1);
  });
});
