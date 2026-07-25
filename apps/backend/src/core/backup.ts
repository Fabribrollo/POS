import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../generated/prisma/index.js";

const RETENCION_DIARIOS = 30;
const RETENCION_MESES = 12;
const INTERVALO_PROGRAMADO_MS = 24 * 60 * 60 * 1000;

interface EstadoBackup {
  ultimoBackup: string;
}

function archivoEstado(backupsDir: string): string {
  return path.join(backupsDir, "ultimo.json");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Timestamp propio en UTC (no toISOString()) para controlar el formato exacto
// del nombre de archivo y poder parsearlo de vuelta sin ambigüedad de zona
// horaria al aplicar la retención.
function timestampUtc(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}T${pad(
    fecha.getUTCHours(),
  )}-${pad(fecha.getUTCMinutes())}-${pad(fecha.getUTCSeconds())}Z`;
}

function nombreArchivo(fecha: Date): string {
  return `pos-${timestampUtc(fecha)}.db`;
}

const PATRON_ARCHIVO = /^pos-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.db$/;

function fechaDeArchivo(nombre: string): Date | null {
  const m = nombre.match(PATRON_ARCHIVO);
  if (!m) return null;
  const [, anio, mes, dia, hora, minuto, segundo] = m;
  return new Date(
    Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo)),
  );
}

// Copia atómica y consistente de la SQLite en uso, sin depender de ninguna
// librería nueva: VACUUM INTO es una sentencia nativa de SQLite (soportada
// por el motor que ya trae @prisma/client) pensada exactamente para esto,
// a diferencia de un fs.copyFile crudo que podría capturar el archivo a
// mitad de una escritura.
export async function crearBackup(prisma: PrismaClient, backupsDir: string): Promise<string> {
  fs.mkdirSync(backupsDir, { recursive: true });
  const ahora = new Date();
  const destino = path.join(backupsDir, nombreArchivo(ahora));

  await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

  const estado: EstadoBackup = { ultimoBackup: ahora.toISOString() };
  fs.writeFileSync(archivoEstado(backupsDir), JSON.stringify(estado));

  aplicarRetencion(backupsDir);
  copiarANube(destino);
  return destino;
}

// Exporta el backup a una carpeta que el usuario ya tenga sincronizada con
// Google Drive, Dropbox o similar (el cliente de escritorio de esa app sube
// el archivo solo — no hay ninguna integración con una API de nube acá). Se
// lee process.env directo en vez de centralizarlo en config.ts porque es un
// valor opcional que además necesita poder cambiar en los tests sin reiniciar
// el proceso.
//
// Es "mejor esfuerzo": si la carpeta no está configurada, no existe o falla
// la copia, se loguea y se sigue. Perder la copia en la nube nunca debe tirar
// abajo el backup local, que para este punto ya se completó.
function copiarANube(origenBackup: string): void {
  const carpetaNube = process.env.BACKUP_CLOUD_DIR;
  if (!carpetaNube) return;

  try {
    fs.mkdirSync(carpetaNube, { recursive: true });
    fs.copyFileSync(origenBackup, path.join(carpetaNube, path.basename(origenBackup)));
    aplicarRetencion(carpetaNube);
  } catch (err) {
    console.error("[backup] no se pudo copiar el backup a la carpeta en la nube", err);
  }
}

// Para una app de escritorio que no corre 24/7, "programado" no puede ser un
// cron real: se pregunta en cada arranque (y periódicamente mientras sigue
// abierta) si pasó más de un día desde el último backup exitoso.
export function debeBackupProgramado(backupsDir: string): boolean {
  const ruta = archivoEstado(backupsDir);
  if (!fs.existsSync(ruta)) return true;
  try {
    const estado = JSON.parse(fs.readFileSync(ruta, "utf-8")) as EstadoBackup;
    const ultimo = new Date(estado.ultimoBackup).getTime();
    return Date.now() - ultimo >= INTERVALO_PROGRAMADO_MS;
  } catch {
    return true;
  }
}

// Conserva los últimos RETENCION_DIARIOS backups más un backup por mes de los
// últimos RETENCION_MESES meses (aunque ya tengan más de 30 días), para tener
// puntos de referencia lejanos sin acumular espacio indefinidamente. Nunca
// borra si no queda más de un backup.
export function aplicarRetencion(backupsDir: string): void {
  const conFecha = fs
    .readdirSync(backupsDir)
    .map((nombre) => ({ nombre, fecha: fechaDeArchivo(nombre) }))
    .filter((a): a is { nombre: string; fecha: Date } => a.fecha !== null)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  if (conFecha.length <= 1) return;

  const aConservar = new Set<string>();
  for (const a of conFecha.slice(0, RETENCION_DIARIOS)) {
    aConservar.add(a.nombre);
  }

  const limiteMensual = new Date();
  limiteMensual.setUTCMonth(limiteMensual.getUTCMonth() - RETENCION_MESES);
  const mesesConservados = new Set<string>();
  for (const a of conFecha) {
    if (a.fecha < limiteMensual) continue;
    const clave = `${a.fecha.getUTCFullYear()}-${a.fecha.getUTCMonth()}`;
    if (!mesesConservados.has(clave)) {
      mesesConservados.add(clave);
      aConservar.add(a.nombre);
    }
  }

  for (const a of conFecha) {
    if (!aConservar.has(a.nombre)) {
      fs.unlinkSync(path.join(backupsDir, a.nombre));
    }
  }
}
