import { useMutation } from "@tanstack/react-query";
import type { CrearDevolucionInput } from "@pos/shared";
import { api } from "@/shared/api/client";

export interface ItemVentaParaDevolucion {
  itemVentaId: number;
  productoId: number;
  varianteId: number | null;
  nombre: string;
  precioUnitario: number;
  descuento: number;
  cantidad: number;
  cantidadDevuelta: number;
  cantidadDisponible: number;
}

export interface VentaParaDevolucion {
  id: number;
  numero: string;
  clienteId: number | null;
  cliente: { id: number; nombre: string } | null;
  total: number;
  items: ItemVentaParaDevolucion[];
}

export async function buscarVentaParaDevolucion(numero: string): Promise<VentaParaDevolucion> {
  const { data } = await api.get<VentaParaDevolucion>(
    `/devoluciones/buscar/${encodeURIComponent(numero)}`,
  );
  return data;
}

export interface DevolucionCreada {
  id: number;
  ventaOriginalId: number;
  clienteId: number | null;
  tipo: string;
  montoReintegro: string;
}

export function useCrearDevolucion() {
  return useMutation({
    mutationFn: async (input: CrearDevolucionInput) =>
      (await api.post<DevolucionCreada>("/devoluciones", input)).data,
  });
}
