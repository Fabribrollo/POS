import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // App de escritorio de un solo puesto: refetchear en cada foco de ventana
    // (Electron cambia de foco todo el tiempo) solo genera tráfico contra el
    // backend local sin ganar nada; la invalidación explícita post-mutación
    // (ver useCrearVenta, useAbrirCaja, etc.) ya mantiene todo sincronizado.
    queries: { refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
        <Toaster />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
