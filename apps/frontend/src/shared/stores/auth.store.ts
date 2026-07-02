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
  setSesion: (token: string, usuario: SesionUsuario) => void;
  cerrarSesion: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      setSesion: (token, usuario) => set({ token, usuario }),
      cerrarSesion: () => set({ token: null, usuario: null }),
    }),
    { name: "pos-auth" },
  ),
);
