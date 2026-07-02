import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

// pnpm resuelve los paquetes del workspace (@pos/backend, @pos/shared) como
// symlinks a carpetas HERMANAS de apps/electron. electron-builder no sabe
// empaquetar eso ("must be under apps/electron/"), así que en vez de pelear
// con esa restricción, generamos un bundle único y autocontenido: todo el
// código propio (electron + @pos/backend + @pos/shared + el cliente Prisma
// generado en apps/backend/generated/prisma) queda inline en un solo
// archivo. Lo único externo real es el módulo nativo "electron".
const externos = ["electron"];

// Formato CJS (no ESM): varias dependencias transitivas de Express (ej.
// "depd") usan un require() dinámico que esbuild no puede resolver de forma
// estática en salida ESM ("Dynamic require of ... is not supported"). CJS es
// además el formato tradicionalmente más compatible para el proceso
// principal de Electron. La extensión .cjs fuerza a Node a tratarlo como
// CommonJS aunque el package.json del paquete diga "type": "module".
await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: externos,
});

await build({
  entryPoints: ["src/preload.ts"],
  outfile: "dist/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron"],
});

// El motor de consultas de Prisma es un binario nativo: esbuild lo deja tal
// cual (no lo puede "bundlear" como JS) y el cliente generado lo busca en
// tiempo de ejecución con una ruta relativa a __dirname. Como todo el código
// quedó compactado en un solo dist/main.cjs, ese __dirname pasa a ser esta
// misma carpeta dist/ — así que los binarios tienen que vivir acá al lado.
const prismaGenerado = path.resolve("../backend/generated/prisma");
const patronesAsset = [/^libquery_engine-.*\.node$/, /^query_engine-.*\.node$/, /^schema\.prisma$/];

for (const archivo of fs.readdirSync(prismaGenerado)) {
  if (patronesAsset.some((patron) => patron.test(archivo))) {
    fs.copyFileSync(path.join(prismaGenerado, archivo), path.join("dist", archivo));
  }
}

console.log("[esbuild] main.cjs, preload.cjs y binarios del motor Prisma listos en dist/");
