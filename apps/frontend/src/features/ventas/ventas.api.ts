import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrearVentaInput } from "@pos/shared";
import { api } from "@/shared/api/client";
import type { Producto } from "../productos/productos.api";

export interface Caja {
  id: number;
  estado: string;
  montoApertura: string;
}

export function useCajaAbierta() {
  return useQuery({
    queryKey: ["caja", "abierta"],
    queryFn: async () => {
      try {
        const { data } = await api.get<Caja>("/caja/abierta");
        return data;
      } catch {
        return null;
      }
    },
  });
}

export async function buscarProductoPorCodigo(codigo: string): Promise<Producto> {
  const { data } = await api.get<Producto>(`/productos/buscar/${encodeURIComponent(codigo)}`);
  return data;
}

export function useCrearVenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearVentaInput) => (await api.post("/ventas", input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja"] });
    },
  });
}
