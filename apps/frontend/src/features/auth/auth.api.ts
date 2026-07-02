import { useMutation } from "@tanstack/react-query";
import type { LoginInput, RolNombre } from "@pos/shared";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/shared/stores/auth.store";

interface LoginResponse {
  token: string;
  usuario: { id: number; nombre: string; rol: RolNombre };
}

export function useLogin() {
  const setSesion = useAuthStore((s) => s.setSesion);

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<LoginResponse>("/auth/login", input);
      return data;
    },
    onSuccess: (data) => setSesion(data.token, data.usuario),
  });
}
