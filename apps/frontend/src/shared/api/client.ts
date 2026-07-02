import axios from "axios";
import { useAuthStore } from "@/shared/stores/auth.store";

export const api = axios.create({ baseURL: "/api" });

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
