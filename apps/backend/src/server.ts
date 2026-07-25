import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./core/middlewares/errorHandler.js";
import { auditoriaRouter } from "./modules/auditoria/auditoria.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cajaRouter } from "./modules/caja/caja.routes.js";
import { categoriasRouter } from "./modules/categorias/categorias.routes.js";
import { clientesRouter } from "./modules/clientes/clientes.routes.js";
import { comprasRouter } from "./modules/compras/compras.routes.js";
import { devolucionesRouter } from "./modules/devoluciones/devoluciones.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { listasPrecioRouter } from "./modules/listas-precio/listasPrecio.routes.js";
import { marcasRouter } from "./modules/marcas/marcas.routes.js";
import { negocioRouter } from "./modules/negocio/negocio.routes.js";
import { productosRouter } from "./modules/productos/productos.routes.js";
import { proveedoresRouter } from "./modules/proveedores/proveedores.routes.js";
import { reportesRouter } from "./modules/reportes/reportes.routes.js";
import { stockRouter } from "./modules/stock/stock.routes.js";
import { usuariosRouter } from "./modules/usuarios/usuarios.routes.js";
import { ventasRouter } from "./modules/ventas/ventas.routes.js";

// Orígenes reales desde los que este backend recibe requests de navegador:
// Vite en desarrollo (tanto suelto como cargado por Electron con
// win.loadURL), y la ventana de Electron empaquetada, que carga el frontend
// con win.loadFile (protocolo file://) — Chromium serializa ese origen
// "opaco" como el string literal "null" en el header Origin, no como
// ausencia del header. Un origin() abierto (cors() sin opciones) dejaría
// pasar cualquier página web que alguien tenga abierta en el navegador.
const ORIGENES_PERMITIDOS = new Set(["http://localhost:5173", "http://127.0.0.1:5173", "null"]);

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // Sin header Origin: no es una request cross-origin de navegador (curl,
  // health checks, etc.) — no aplica CORS.
  // Para un origen no permitido se responde `allow: false` (no un error): el
  // middleware "cors" simplemente omite el header Access-Control-Allow-Origin
  // en la respuesta, que es lo que hace que el navegador bloquee la lectura
  // de la respuesta del lado del script. Pasar un Error acá lo mandaría al
  // errorHandler genérico como si fuera un 500 real, ensuciando los logs por
  // algo que es un bloqueo esperado, no una falla del servidor.
  callback(null, !origin || ORIGENES_PERMITIDOS.has(origin));
}

// Fábrica de la app de Express. NO llama a listen() acá: eso lo decide quien
// importa este módulo (dev.ts en desarrollo local, o el bootstrap de Electron
// en producción, que necesita elegir el puerto en runtime).
export function createServer(): Express {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  // 15mb: la importación de productos manda el .xlsx completo como base64 en
  // el body (evita sumar multer solo para este endpoint); el default de
  // express (100kb) alcanza para el resto de la API pero no para un archivo.
  app.use(express.json({ limit: "15mb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/usuarios", usuariosRouter);
  app.use("/api/categorias", categoriasRouter);
  app.use("/api/marcas", marcasRouter);
  app.use("/api/productos", productosRouter);
  app.use("/api/listas-precio", listasPrecioRouter);
  app.use("/api/stock", stockRouter);
  app.use("/api/caja", cajaRouter);
  app.use("/api/ventas", ventasRouter);
  app.use("/api/devoluciones", devolucionesRouter);
  app.use("/api/clientes", clientesRouter);
  app.use("/api/proveedores", proveedoresRouter);
  app.use("/api/compras", comprasRouter);
  app.use("/api/reportes", reportesRouter);
  app.use("/api/negocio", negocioRouter);
  app.use("/api/auditoria", auditoriaRouter);

  app.use(errorHandler);

  return app;
}
