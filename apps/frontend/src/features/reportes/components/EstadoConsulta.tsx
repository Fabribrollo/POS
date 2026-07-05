import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpretarError } from "@/shared/api/client";

function SkeletonFilas() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 rounded-md bg-muted" />
      ))}
    </div>
  );
}

interface EstadoConsultaProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  onReintentar: () => void;
  vacioTitulo?: string;
  vacioMensaje?: string;
  children: React.ReactNode;
}

// Único lugar donde se resuelven los 5 estados posibles de cualquier
// consulta de un reporte: cargando / error (con mensaje según el tipo y
// botón de reintento cuando tiene sentido) / vacío / éxito. Así ninguna
// página de reportes tiene que reimplementar esto.
export function EstadoConsulta({
  isLoading,
  error,
  isEmpty,
  onReintentar,
  vacioTitulo = "Sin resultados",
  vacioMensaje = "No hay datos para los filtros aplicados.",
  children,
}: EstadoConsultaProps) {
  if (isLoading) return <SkeletonFilas />;

  if (error) {
    const { titulo, mensaje, reintentable } = interpretarError(error);
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <AlertTriangle className="size-8 text-destructive" />
        <div>
          <p className="font-medium">{titulo}</p>
          <p className="text-sm text-muted-foreground">{mensaje}</p>
        </div>
        {reintentable && (
          <Button variant="outline" size="sm" onClick={onReintentar}>
            <RefreshCw className="size-4" />
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        <p className="font-medium text-foreground">{vacioTitulo}</p>
        <p className="text-sm">{vacioMensaje}</p>
      </div>
    );
  }

  return <>{children}</>;
}
