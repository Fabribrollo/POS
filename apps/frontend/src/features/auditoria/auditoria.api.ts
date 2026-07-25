import { useQuery } from "@tanstack/react-query";
import type { FiltrosReporte, RespuestaPaginada } from "@/features/reportes/reportes.api";
import { api } from "@/shared/api/client";

const INTERVALO_AUTO_REFRESH = 60_000;

export interface LogAuditoria {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: number | null;
  detalle: Record<string, unknown> | null;
}

export interface FiltrosAuditoria extends FiltrosReporte {
  usuarioId?: number;
  entidad?: string;
  accion?: string;
}

export function useAuditoria(filtros: FiltrosAuditoria) {
  return useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: async () =>
      (await api.get<RespuestaPaginada<LogAuditoria>>("/auditoria", { params: filtros })).data,
    refetchInterval: INTERVALO_AUTO_REFRESH,
  });
}
