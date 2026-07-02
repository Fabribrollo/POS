import path from "node:path";
import { app, BrowserWindow } from "electron";
import { startBackend } from "./backend-bootstrap.js";

// __dirname es nativo acá: el bundle final (ver esbuild.config.mjs) se
// genera en CJS a propósito, así que no hace falta derivarlo de
// import.meta.url como en ESM puro.
const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
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
