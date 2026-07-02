import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AbrirCajaInput, CerrarCajaInput, MovimientoCajaInput } from "@pos/shared";
import { api } from "@/shared/api/client";

export interface Caja {
  id: number;
  estado: string;
  montoApertura: string;
  montoCierreDeclarado: string | null;
  montoCierreSistema: string | null;
  diferencia: string | null;
  fechaApertura: string;
}

export interface MovimientoCaja {
  id: number;
  tipo: string;
  monto: string;
  concepto: string;
  createdAt: string;
  usuario: { nombre: string };
}

export function useCajaAbierta() {
  return useQuery({
    queryKey: ["caja", "abierta"],
    queryFn: async () => {
      try {
        return (await api.get<Caja>("/caja/abierta")).data;
      } catch {
        return null;
      }
    },
  });
}

export function useMovimientosCaja(cajaId?: number) {
  return useQuery({
    queryKey: ["caja", cajaId, "movimientos"],
    queryFn: async () => (await api.get<MovimientoCaja[]>(`/caja/${cajaId}/movimientos`)).data,
    enabled: !!cajaId,
  });
}

function useInvalidarCaja() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["caja"] });
}

export function useAbrirCaja() {
  const invalidar = useInvalidarCaja();
  return useMutation({
    mutationFn: async (input: AbrirCajaInput) => (await api.post("/caja/abrir", input)).data,
    onSuccess: invalidar,
  });
}

export function useRegistrarMovimiento() {
  const invalidar = useInvalidarCaja();
  return useMutation({
    mutationFn: async (input: MovimientoCajaInput) =>
      (await api.post("/caja/movimientos", input)).data,
    onSuccess: invalidar,
  });
}

export function useCerrarCaja() {
  const invalidar = useInvalidarCaja();
  return useMutation({
    mutationFn: async (input: CerrarCajaInput) => (await api.post("/caja/cerrar", input)).data,
    onSuccess: invalidar,
  });
}
