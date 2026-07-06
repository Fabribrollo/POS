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

export interface ItemVentaCompleta {
  id: number;
  productoId: number;
  varianteId: number | null;
  cantidad: number;
  precioUnitario: string;
  descuento: string;
  subtotal: string;
  producto: { id: number; nombre: string; codigoInterno: string };
  variante: { id: number; nombre: string } | null;
}

export interface PagoVentaCompleta {
  id: number;
  monto: string;
  cuotas: number | null;
  recargo: string | null;
  referencia: string | null;
  medioPago: { id: number; nombre: string };
}

export interface VentaCompleta {
  id: number;
  numero: string;
  cliente: { id: number; nombre: string } | null;
  usuario: { id: number; nombre: string };
  subtotal: string;
  descuentoTotal: string;
  total: string;
  estado: string;
  createdAt: string;
  items: ItemVentaCompleta[];
  pagos: PagoVentaCompleta[];
}

export interface Negocio {
  nombre: string;
  direccion: string;
  cuit: string;
}

export function useCrearVenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearVentaInput) =>
      (await api.post<VentaCompleta>("/ventas", input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja"] });
    },
  });
}

// Para reimprimir un ticket desde el historial: la fila del reporte no trae
// el detalle de ítems, así que se pide la venta completa recién al hacer clic.
export async function obtenerVentaCompleta(id: number): Promise<VentaCompleta> {
  const { data } = await api.get<VentaCompleta>(`/ventas/${id}`);
  return data;
}

export function useNegocio() {
  return useQuery({
    queryKey: ["negocio"],
    queryFn: async () => (await api.get<Negocio>("/negocio")).data,
    staleTime: Infinity,
  });
}
