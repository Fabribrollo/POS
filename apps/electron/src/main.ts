import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, Menu } from "electron";
import { startBackend } from "./backend-bootstrap.js";

// __dirname es nativo acá: el bundle final (ver esbuild.config.mjs) se
// genera en CJS a propósito, así que no hace falta derivarlo de
// import.meta.url como en ESM puro.
const isDev = !app.isPackaged;

interface NegocioConfig {
  nombre: string;
  direccion: string;
  cuit: string;
  logoFile: string | null;
}

// Generado por esbuild.config.mjs a partir del .env de la raíz del repo
// (ver ese archivo para el porqué: main.ts nunca carga dotenv directamente).
// Vive al lado de main.cjs en dist/, así que __dirname sirve tanto en dev
// como empaquetado.
function leerNegocioConfig(): NegocioConfig {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "negocio.config.json"), "utf-8");
    return JSON.parse(raw) as NegocioConfig;
  } catch {
    return { nombre: "", direccion: "", cuit: "", logoFile: null };
  }
}

const negocioConfig = leerNegocioConfig();
const negocioLogoPath = negocioConfig.logoFile ? path.join(__dirname, negocioConfig.logoFile) : null;

// Se setean acá (antes de que backend-bootstrap.ts importe @pos/backend) en
// vez de dejar que el backend lea el .env por su cuenta: así el mismo valor
// sirve para el título/ícono de esta ventana y para lo que expone la API.
if (negocioConfig.nombre) process.env.NEGOCIO_NOMBRE = negocioConfig.nombre;
if (negocioConfig.direccion) process.env.NEGOCIO_DIRECCION = negocioConfig.direccion;
if (negocioConfig.cuit) process.env.NEGOCIO_CUIT = negocioConfig.cuit;
if (negocioLogoPath) process.env.NEGOCIO_LOGO = negocioLogoPath;

// Sin esto, Windows/Linux muestran la barra de menú por defecto de Electron
// (File/Edit/View/...), que no tiene sentido para un POS de pantalla
// completa con su propia navegación. En dev se deja para poder abrir
// DevTools desde el menú si hace falta.
if (!isDev) {
  Menu.setApplicationMenu(null);
}

async function createWindow(): Promise<void> {
  const titulo = negocioConfig.nombre || "POS Indumentaria";

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 720,
    title: titulo,
    ...(negocioLogoPath ? { icon: negocioLogoPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // El frontend no define un <title> por negocio (es un template genérico de
  // Vite), pero por las dudas: si alguna vez lo hace, no debe pisar el
  // nombre del negocio en la barra de título/taskbar.
  win.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  // Pantalla de carga estática mientras el backend levanta y migra, para no
  // mostrar una ventana en blanco durante ese lapso.
  await win.loadURL(
    `data:text/html,<body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">Iniciando POS...</body>`,
  );

  const port = await startBackend();

  if (isDev) {
    await win.loadURL(`http://localhost:5173/?apiPort=${port}`);
  } else {
    // En el paquete final el frontend viaja como extraResource (ver
    // "build.extraResources" en package.json), no dentro de dist/ del
    // propio electron ni relativo al repo.
    await win.loadFile(path.join(process.resourcesPath, "frontend", "index.html"), {
      query: { apiPort: String(port) },
    });
  }

  // El <title>frontend</title> del build de Vite pisa el título de la
  // ventana apenas termina de cargar (el listener de "page-title-updated"
  // de arriba no alcanza a frenarlo en todos los casos), así que se
  // reafirma acá explícitamente.
  win.setTitle(titulo);
}

// Un POS solo debe tener una instancia escribiendo la SQLite del usuario a
// la vez. Si el usuario hace doble clic en el instalador dos veces, la
// segunda simplemente enfoca la ventana ya abierta en vez de arrancar otro
// backend en paralelo contra el mismo archivo.
const tieneLock = app.requestSingleInstanceLock();
if (!tieneLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
