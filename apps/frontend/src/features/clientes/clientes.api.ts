import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export interface Cliente {
  id: number;
  nombre: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
}

export interface CrearClienteInput {
  nombre: string;
  documento?: string;
}

export function useCrearCliente() {
  return useMutation({
    mutationFn: async (input: CrearClienteInput) =>
      (await api.post<Cliente>("/clientes", input)).data,
  });
}

export interface ItemCompraHistorial {
  id: number;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  producto: { nombre: string };
  variante: { nombre: string } | null;
}

export interface PagoCompraHistorial {
  id: number;
  monto: string;
  medioPago: { nombre: string };
}

export interface CompraHistorial {
  id: number;
  numero: string;
  total: string;
  createdAt: string;
  items: ItemCompraHistorial[];
  pagos: PagoCompraHistorial[];
}

export function useHistorialCompras(clienteId: number | null) {
  return useQuery({
    queryKey: ["clientes", clienteId, "compras"],
    queryFn: async () => (await api.get<CompraHistorial[]>(`/clientes/${clienteId}/compras`)).data,
    enabled: clienteId != null,
  });
}
