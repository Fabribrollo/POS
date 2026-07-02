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

  // Import dinámico A PROPÓSITO: @prisma/client autocarga el .env del repo
  // al importarse (y con él, el DATABASE_URL de desarrollo apuntando a
  // prisma/dev.db). Un import estático de "@pos/backend" se evalúa antes de
  // que la línea de arriba corra, así que el singleton de Prisma quedaría
  // conectado al dev.db del repo en vez de a la DB real del usuario. Este
  // import diferido garantiza que DATABASE_URL ya esté seteado primero.
  const { createServer, prisma, runMigrations, seedInicial } = await import("@pos/backend");

  await runMigrations(prisma, resolverDirectorioMigraciones());
  await seedInicial();

  const server = createServer();

  return new Promise((resolve) => {
    const listener = server.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve(port);
    });
  });
}
