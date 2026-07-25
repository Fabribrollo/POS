import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RolNombre } from "@pos/shared";

interface SesionUsuario {
  id: number;
  nombre: string;
  rol: RolNombre;
}

interface AuthState {
  token: string | null;
  usuario: SesionUsuario | null;
  // No viaja en el JWT (que no cambia hasta el próximo login): se guarda
  // aparte para poder mostrar/ocultar el gate obligatorio de cambio de
  // contraseña sin depender de pedir un token nuevo.
  debeCambiarPassword: boolean;
  setSesion: (token: string, usuario: SesionUsuario, debeCambiarPassword: boolean) => void;
  marcarPasswordCambiada: () => void;
  cerrarSesion: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      debeCambiarPassword: false,
      setSesion: (token, usuario, debeCambiarPassword) => set({ token, usuario, debeCambiarPassword }),
      marcarPasswordCambiada: () => set({ debeCambiarPassword: false }),
      cerrarSesion: () => set({ token: null, usuario: null, debeCambiarPassword: false }),
    }),
    { name: "pos-auth" },
  ),
);
