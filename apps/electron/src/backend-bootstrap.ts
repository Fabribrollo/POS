import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

// __dirname es nativo del bundle CJS final (ver esbuild.config.mjs) y
// resuelve relativo a dónde queda dist/main.cjs, no al archivo fuente.
//
// En dev, las migraciones viven en el repo (prisma/migrations). En producción
// empaquetada, electron-builder las copia como extraResource (ver etapa
// "Instalador" del roadmap) a resourcesPath/migrations.
function resolverDirectorioMigraciones(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "migrations");
  }
  return path.join(__dirname, "../../../prisma/migrations");
}

function resolverDirectorioBackups(): string {
  return path.join(app.getPath("userData"), "backups");
}

// Un secreto de JWT hardcodeado en el código sería el mismo en todas las
// instalaciones de este POS (cualquiera que leyera el código podría forjar
// un token de administrador para cualquier local). Acá se genera uno al azar
// la primera vez que corre esta instalación y se persiste en userData, así
// que cada instalación tiene el suyo y sobrevive a reinicios/actualizaciones.
function resolverJwtSecret(): string {
  const ruta = path.join(app.getPath("userData"), "jwt-secret.key");
  try {
    return fs.readFileSync(ruta, "utf-8").trim();
  } catch {
    const secreto = crypto.randomBytes(48).toString("hex");
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, secreto, { mode: 0o600 });
    return secreto;
  }
}

// Por si el local deja la PC prendida varios días sin cerrar la app: además
// del chequeo al arrancar, se vuelve a preguntar cada 6hs si ya toca backup.
const INTERVALO_CHEQUEO_BACKUP_MS = 6 * 60 * 60 * 1000;

let backendIniciado: Promise<number> | undefined;

// Memoizado: en macOS el evento "activate" puede dispararse en paralelo con
// el arranque inicial (whenReady), y sin esto dos llamadas concurrentes
// verían "sin migraciones aplicadas" antes de que la primera termine de
// escribir, e intentarían crear las mismas tablas dos veces.
export function startBackend(): Promise<number> {
  if (!backendIniciado) {
    backendIniciado = iniciar();
  }
  return backendIniciado;
}

async function iniciar(): Promise<number> {
  const dbPath = path.join(app.getPath("userData"), "pos.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.JWT_SECRET = resolverJwtSecret();

  // Import dinámico A PROPÓSITO: @prisma/client autocarga el .env del repo
  // al importarse (y con él, el DATABASE_URL de desarrollo apuntando a
  // prisma/dev.db). Un import estático de "@pos/backend" se evalúa antes de
  // que la línea de arriba corra, así que el singleton de Prisma quedaría
  // conectado al dev.db del repo en vez de a la DB real del usuario. Este
  // import diferido garantiza que DATABASE_URL ya esté seteado primero.
  const {
    createServer,
    prisma,
    runMigrations,
    seedInicial,
    crearBackup,
    debeBackupProgramado,
    migracionesPendientes,
  } = await import("@pos/backend");

  const migrationsDir = resolverDirectorioMigraciones();
  const backupsDir = resolverDirectorioBackups();

  // Un backup que falla nunca debe impedir que el POS abra: se registra el
  // error y se sigue. Perder un backup puntual es mucho menos grave que
  // dejar al local sin poder vender.
  async function backupSeguro(): Promise<void> {
    try {
      await crearBackup(prisma, backupsDir);
    } catch (err) {
      console.error("[backup] no se pudo completar el backup", err);
    }
  }

  // "Antes de cada actualización": como todavía no hay auto-actualizador, la
  // ventana de riesgo real es la migración de esquema que corre en este mismo
  // arranque. Si no hay nada para migrar, se evalúa igual el backup
  // programado (para no hacer dos backups seguidos el mismo día).
  const pendientes = await migracionesPendientes(prisma, migrationsDir);
  if (pendientes.length > 0) {
    await backupSeguro();
  } else if (debeBackupProgramado(backupsDir)) {
    await backupSeguro();
  }

  await runMigrations(prisma, migrationsDir);
  await seedInicial();

  const server = createServer();

  setInterval(() => {
    if (debeBackupProgramado(backupsDir)) {
      void backupSeguro();
    }
  }, INTERVALO_CHEQUEO_BACKUP_MS);

  return new Promise((resolve) => {
    const listener = server.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve(port);
    });
  });
}
