import { useState } from "react";
import { ACCION_AUDITORIA, ENTIDAD_AUDITORIA } from "@pos/shared";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extraerMensajeError } from "@/shared/api/client";
import { type FiltrosAuditoria, type LogAuditoria, useAuditoria } from "../auditoria/auditoria.api";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import {
  RangoFechasPicker,
  rangoQueryParams,
  rangoUltimosDias,
  type RangoFechasValor,
} from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion } from "./reportes.api";

const ENTIDADES = Object.values(ENTIDAD_AUDITORIA);
const ACCIONES = Object.values(ACCION_AUDITORIA);

// El detalle guardado varía según la acción (numero de venta, motivo, cambio
// de precio antes/después, etc.) — se muestra como una lista compacta
// "clave: valor" en vez de intentar una columna por cada campo posible.
function formatearDetalle(detalle: LogAuditoria["detalle"]): string {
  if (!detalle) return "-";
  return Object.entries(detalle)
    .map(([clave, valor]) => {
      if (valor && typeof valor === "object" && "antes" in valor && "despues" in valor) {
        const cambio = valor as { antes: unknown; despues: unknown };
        return `${clave}: ${cambio.antes} → ${cambio.despues}`;
      }
      return `${clave}: ${String(valor)}`;
    })
    .join(" · ");
}

const COLUMNAS: ColumnaTabla<LogAuditoria>[] = [
  { key: "fecha", header: "Fecha", render: (l) => new Date(l.fecha).toLocaleString("es-AR") },
  { key: "usuario", header: "Usuario", render: (l) => l.usuario, ordenable: false },
  { key: "accion", header: "Acción", render: (l) => l.accion },
  { key: "entidad", header: "Entidad", render: (l) => l.entidad },
  { key: "entidadId", header: "ID", align: "right", render: (l) => l.entidadId ?? "-" },
  { key: "detalle", header: "Detalle", ordenable: false, render: (l) => formatearDetalle(l.detalle) },
];

export function AuditoriaReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [entidad, setEntidad] = useState("");
  const [accion, setAccion] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "fecha",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros: FiltrosAuditoria = {
    ...rangoQueryParams(rango),
    busqueda: busqueda || undefined,
    entidad: entidad || undefined,
    accion: accion || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useAuditoria(filtros);

  function ordenarPor(columna: string) {
    setOrden((actual) =>
      actual.columna === columna
        ? { columna, direccion: actual.direccion === "asc" ? "desc" : "asc" }
        : { columna, direccion: "asc" },
    );
    setPagina(1);
  }

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(true);
    try {
      await descargarExportacion(
        `/auditoria/exportar.${formato}`,
        { ...rangoQueryParams(rango), busqueda: busqueda || undefined, entidad: entidad || undefined, accion: accion || undefined },
        `auditoria.${formato}`,
      );
    } catch (err) {
      toast.error(extraerMensajeError(err));
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <RangoFechasPicker
            value={rango}
            onChange={(v) => {
              setRango(v);
              setPagina(1);
            }}
          />
          <Select value={entidad || "todas"} onValueChange={(v) => { setEntidad(v === "todas" ? "" : (v ?? "")); setPagina(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las entidades</SelectItem>
              {ENTIDADES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accion || "todas"} onValueChange={(v) => { setAccion(v === "todas" ? "" : (v ?? "")); setPagina(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las acciones</SelectItem>
              {ACCIONES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground no-imprimir">
            {isFetching ? "Actualizando..." : `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString("es-AR")}`}
          </span>
          <ExportarBotones
            onExportarExcel={() => exportar("xlsx")}
            onExportarPdf={() => exportar("pdf")}
            exportando={exportando}
          />
        </div>
      </div>

      <EstadoConsulta
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && (data?.datos.length ?? 0) === 0}
        onReintentar={() => refetch()}
        vacioTitulo="Sin registros de auditoría"
        vacioMensaje="Probá ampliar el rango de fechas o cambiar los filtros."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(l) => l.id}
          orden={orden}
          onOrdenar={ordenarPor}
          busqueda={{
            valor: busqueda,
            onCambiar: (v) => {
              setBusqueda(v);
              setPagina(1);
            },
            placeholder: "Buscar por usuario, entidad o detalle",
          }}
          paginacion={{
            pagina,
            totalPaginas: data?.totalPaginas ?? 1,
            onCambiarPagina: setPagina,
          }}
        />
      </EstadoConsulta>
    </div>
  );
}
