import axios from "axios";
import { useAuthStore } from "@/shared/stores/auth.store";

// En el paquete final (file://) y en dev vía Electron, main.ts inyecta el
// puerto real del backend embebido como ?apiPort=... (ver electron/src/main.ts).
// Una baseURL relativa como "/api" se resolvería contra el origen file://
// y nunca llegaría al backend. Sin ese query param (dev suelto con
// `pnpm dev:frontend`), se usa "/api" y el proxy de Vite hace el resto.
const apiPort = new URLSearchParams(window.location.search).get("apiPort");
const baseURL = apiPort ? `http://127.0.0.1:${apiPort}/api` : "/api";

export const api = axios.create({ baseURL });

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
