import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "../generated/prisma/index.js";
import { aplicarRetencion, crearBackup, debeBackupProgramado } from "../src/core/backup.js";
import { prisma } from "../src/core/prisma.js";

let tmpDir: string;
const cloudDirEnvOriginal = process.env.BACKUP_CLOUD_DIR;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-backup-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (cloudDirEnvOriginal === undefined) {
    delete process.env.BACKUP_CLOUD_DIR;
  } else {
    process.env.BACKUP_CLOUD_DIR = cloudDirEnvOriginal;
  }
});

function nombreParaFecha(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `pos-${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}T${pad(
    fecha.getUTCHours(),
  )}-${pad(fecha.getUTCMinutes())}-${pad(fecha.getUTCSeconds())}Z.db`;
}

function diasAtras(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("backup", () => {
  it("crearBackup genera un archivo .db legible con los datos reales", async () => {
    const destino = await crearBackup(prisma, tmpDir);
    expect(fs.existsSync(destino)).toBe(true);
    expect(path.basename(destino)).toMatch(/^pos-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.db$/);

    const clienteBackup = new PrismaClient({ datasources: { db: { url: `file:${destino}` } } });
    try {
      const admin = await clienteBackup.usuario.findUnique({ where: { email: "admin@pos.local" } });
      expect(admin).not.toBeNull();
    } finally {
      await clienteBackup.$disconnect();
    }
  });

  it("crearBackup registra la fecha en ultimo.json", async () => {
    const antes = Date.now();
    await crearBackup(prisma, tmpDir);
    const estado = JSON.parse(fs.readFileSync(path.join(tmpDir, "ultimo.json"), "utf-8"));
    expect(new Date(estado.ultimoBackup).getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("debeBackupProgramado es true sin backups previos y false justo después de uno", async () => {
    expect(debeBackupProgramado(tmpDir)).toBe(true);
    await crearBackup(prisma, tmpDir);
    expect(debeBackupProgramado(tmpDir)).toBe(false);
  });

  it("debeBackupProgramado vuelve a ser true si pasaron más de 24hs", () => {
    fs.writeFileSync(
      path.join(tmpDir, "ultimo.json"),
      JSON.stringify({ ultimoBackup: diasAtras(2).toISOString() }),
    );
    expect(debeBackupProgramado(tmpDir)).toBe(true);
  });

  it("nunca borra si solo queda un backup, sin importar la antigüedad", () => {
    fs.writeFileSync(path.join(tmpDir, nombreParaFecha(diasAtras(2000))), "");
    aplicarRetencion(tmpDir);
    expect(fs.readdirSync(tmpDir)).toHaveLength(1);
  });

  it("conserva los últimos 30 diarios + 1 por mes de los últimos 12 meses, y borra el resto", () => {
    // Fecha fija a mitad de mes: evita que el corte entre "los 30 más
    // recientes" (índices 0-29) y "el resto" (30-34) caiga justo en un
    // límite de mes, lo que haría el resultado depender de qué día es hoy
    // cuando corre el test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    try {
      // 35 backups diarios consecutivos (día 0 a día 34).
      for (let i = 0; i < 35; i++) {
        fs.writeFileSync(path.join(tmpDir, nombreParaFecha(diasAtras(i))), "");
      }
      // Uno bien viejo pero dentro de la ventana mensual (6 meses).
      const backup6Meses = diasAtras(30 * 6);
      fs.writeFileSync(path.join(tmpDir, nombreParaFecha(backup6Meses)), "");
      // Uno fuera de la ventana mensual (13 meses).
      fs.writeFileSync(path.join(tmpDir, nombreParaFecha(diasAtras(30 * 13))), "");

      aplicarRetencion(tmpDir);

      const restantes = fs.readdirSync(tmpDir);
      // Los 30 más recientes (día 0 a 29) + el de 6 meses = 31.
      expect(restantes).toHaveLength(31);
      expect(restantes).toContain(nombreParaFecha(diasAtras(0)));
      expect(restantes).toContain(nombreParaFecha(diasAtras(29)));
      expect(restantes).not.toContain(nombreParaFecha(diasAtras(34)));
      expect(restantes).toContain(nombreParaFecha(backup6Meses));
      expect(restantes).not.toContain(nombreParaFecha(diasAtras(30 * 13)));
    } finally {
      vi.useRealTimers();
    }
  });

  it("con BACKUP_CLOUD_DIR configurado, copia el backup también a esa carpeta", async () => {
    const cloudDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-backup-cloud-"));
    try {
      process.env.BACKUP_CLOUD_DIR = cloudDir;
      const destino = await crearBackup(prisma, tmpDir);
      const copiaEnNube = path.join(cloudDir, path.basename(destino));
      expect(fs.existsSync(copiaEnNube)).toBe(true);
      expect(fs.readFileSync(copiaEnNube).equals(fs.readFileSync(destino))).toBe(true);
    } finally {
      fs.rmSync(cloudDir, { recursive: true, force: true });
    }
  });

  it("sin BACKUP_CLOUD_DIR configurado, el backup local se completa igual sin intentar copiar a ningún lado", async () => {
    delete process.env.BACKUP_CLOUD_DIR;
    const destino = await crearBackup(prisma, tmpDir);
    expect(fs.existsSync(destino)).toBe(true);
  });
});
