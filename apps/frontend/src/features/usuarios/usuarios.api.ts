import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActualizarUsuarioInput, CrearUsuarioInput, RolNombre } from "@pos/shared";
import { api } from "@/shared/api/client";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  debeCambiarPassword: boolean;
  ultimoLogin: string | null;
  createdAt: string;
  rol: { id: number; nombre: RolNombre };
}

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data,
  });
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearUsuarioInput) => (await api.post<Usuario>("/usuarios", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: ActualizarUsuarioInput }) =>
      (await api.patch<Usuario>(`/usuarios/${id}`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useDesactivarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<Usuario>(`/usuarios/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}
