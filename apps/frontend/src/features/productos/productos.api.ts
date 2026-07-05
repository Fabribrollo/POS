import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActualizarProductoInput,
  ActualizarVarianteInput,
  CrearProductoInput,
  CrearVarianteInput,
} from "@pos/shared";
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
  // Suma del stock de todas las variantes del producto; no es un campo
  // editable, se calcula en el backend a partir de los movimientos de stock.
  stockTotal: number;
  categoria: Categoria | null;
  marca: Marca | null;
  variantes?: Variante[];
}

export interface Variante {
  id: number;
  productoId: number;
  nombre: string;
  color: string | null;
  talle: string | null;
  sku: string | null;
  codigoBarras: string | null;
  // Igual que Producto.stockTotal: suma calculada, no un campo propio.
  stock: number;
  activo: boolean;
}

export interface ResultadoImportacion {
  importado: boolean;
  productosNuevos: number;
  variantesNuevas: number;
  errores: { hoja: "Productos" | "Variantes"; fila: number; motivo: string }[];
}

function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve((lector.result as string).split(",")[1]);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
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

export function useActualizarProducto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: ActualizarProductoInput }) =>
      (await api.patch<Producto>(`/productos/${id}`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useDesactivarProducto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/productos/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useVariantes(productoId: number | undefined) {
  return useQuery({
    queryKey: ["productos", productoId, "variantes"],
    queryFn: async () => (await api.get<Variante[]>(`/productos/${productoId}/variantes`)).data,
    enabled: productoId != null,
  });
}

export function useCrearVariante(productoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearVarianteInput) =>
      (await api.post<Variante>(`/productos/${productoId}/variantes`, input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["productos", productoId, "variantes"] }),
  });
}

export function useActualizarVariante(productoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: ActualizarVarianteInput }) =>
      (await api.patch<Variante>(`/productos/variantes/${id}`, input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["productos", productoId, "variantes"] }),
  });
}

export function useDesactivarVariante(productoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/productos/variantes/${id}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["productos", productoId, "variantes"] }),
  });
}

export function useImportarProductos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (archivo: File) => {
      const archivoBase64 = await archivoABase64(archivo);
      return (await api.post<ResultadoImportacion>("/productos/importar", { archivoBase64 })).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export async function descargarPlantillaProductos() {
  const res = await api.get("/productos/plantilla", { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-productos.xlsx";
  link.click();
  URL.revokeObjectURL(url);
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
