import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrearProductoInput } from "@pos/shared";
import { api } from "@/shared/api/client";

export interface Categoria {
  id: number;
  nombre: string;
}
export interface Marca {
  id: number;
  nombre: string;
}
export interface Producto {
  id: number;
  nombre: string;
  codigoInterno: string;
  codigoBarras: string | null;
  precioCosto: string;
  precioVenta: string;
  stockMinimo: number;
  categoria: Categoria | null;
  marca: Marca | null;
}

export function useProductos() {
  return useQuery({
    queryKey: ["productos"],
    queryFn: async () => (await api.get<Producto[]>("/productos")).data,
  });
}

export function useCrearProducto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearProductoInput) =>
      (await api.post<Producto>("/productos", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await api.get<Categoria[]>("/categorias")).data,
  });
}

export function useCrearCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) =>
      (await api.post<Categoria>("/categorias", { nombre })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categorias"] }),
  });
}

export function useMarcas() {
  return useQuery({
    queryKey: ["marcas"],
    queryFn: async () => (await api.get<Marca[]>("/marcas")).data,
  });
}

export function useCrearMarca() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => (await api.post<Marca>("/marcas", { nombre })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marcas"] }),
  });
}
