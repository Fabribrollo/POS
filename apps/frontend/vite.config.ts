import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el build final se carga vía file:// en Electron
  // (BrowserWindow.loadFile), y con base "/" los assets resolverían contra
  // la raíz del disco en vez de la carpeta empaquetada.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // El puerto del backend se inyecta vía VITE_API_URL en electron/backend-bootstrap;
    // en dev local apunta al server suelto (pnpm dev:backend).
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
});
