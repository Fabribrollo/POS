import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrearVentaInput } from "@pos/shared";
import { api } from "@/shared/api/client";
import type { Producto, Variante } from "../productos/productos.api";

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

// El backend siempre intenta resolver a una variante concreta (única con
// stock propio); si lo escaneado fue el código del producto y tiene más de
// una variante, no elige por vos: pide que el punto de venta muestre un
// selector ("elegir_variante").
export type ResultadoEscaneo =
  | { tipo: "producto"; producto: Producto }
  | { tipo: "variante"; producto: Producto; variante: Variante }
  | { tipo: "elegir_variante"; producto: Producto };

export async function escanearCodigo(codigo: string): Promise<ResultadoEscaneo> {
  const { data } = await api.get<ResultadoEscaneo>(`/productos/buscar/${encodeURIComponent(codigo)}`);
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
