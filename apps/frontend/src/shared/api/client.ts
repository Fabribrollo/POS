import axios from "axios";
import { useAuthStore } from "@/shared/stores/auth.store";

// En el paquete final (file://) y en dev vía Electron, main.ts inyecta el
// puerto real del backend embebido como ?apiPort=... (ver electron/src/main.ts).
// Una baseURL relativa como "/api" se resolvería contra el origen file://
// y nunca llegaría al backend. Sin ese query param (dev suelto con
// `pnpm dev:frontend`), se usa "/api" y el proxy de Vite hace el resto.
const apiPort = new URLSearchParams(window.location.search).get("apiPort");
const baseURL = apiPort ? `http://127.0.0.1:${apiPort}/api` : "/api";

export const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().cerrarSesion();
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function extraerMensajeError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error) && error.response?.data?.error) {
    return error.response.data.error.message;
  }
  return "Ocurrió un error inesperado";
}

export interface ErrorInterpretado {
  titulo: string;
  mensaje: string;
  // Si tiene sentido ofrecer "Reintentar": no aplica a 401 (ya redirige a
  // login) ni a 403 (repetir el mismo pedido nunca va a alcanzar).
  reintentable: boolean;
}

// Traduce cualquier error de una consulta a un mensaje que un usuario no
// técnico pueda entender, distinguiendo red/timeout/4xx/5xx. Pensado para
// pantallas que muestran un estado de error con botón de reintento (ver
// EstadoConsulta en features/reportes), pero es genérico y no depende de
// reportes.
export function interpretarError(error: unknown): ErrorInterpretado {
  if (!axios.isAxiosError(error)) {
    return { titulo: "Error", mensaje: "Ocurrió un error inesperado", reintentable: true };
  }
  if (error.code === "ECONNABORTED") {
    return {
      titulo: "Tiempo de espera agotado",
      mensaje: "La consulta tardó demasiado en responder. Intentá de nuevo.",
      reintentable: true,
    };
  }
  if (!error.response) {
    return {
      titulo: "Sin conexión",
      mensaje: "No se pudo conectar con el servidor. Revisá tu conexión.",
      reintentable: true,
    };
  }
  const status = error.response.status;
  const mensajeBackend = extraerMensajeError(error);
  if (status === 400) return { titulo: "Datos inválidos", mensaje: mensajeBackend, reintentable: true };
  if (status === 401) {
    return {
      titulo: "Sesión expirada",
      mensaje: "Tu sesión expiró, iniciá sesión de nuevo.",
      reintentable: false,
    };
  }
  if (status === 403) {
    return {
      titulo: "Sin permiso",
      mensaje: "No tenés permiso para ver esta información.",
      reintentable: false,
    };
  }
  if (status === 404) {
    return {
      titulo: "No encontrado",
      mensaje: mensajeBackend || "No se encontró información para este pedido.",
      reintentable: true,
    };
  }
  if (status >= 500) {
    return {
      titulo: "Error del servidor",
      mensaje: "Ocurrió un error en el servidor. Intentá nuevamente en unos minutos.",
      reintentable: true,
    };
  }
  return { titulo: "Error", mensaje: mensajeBackend, reintentable: true };
}
