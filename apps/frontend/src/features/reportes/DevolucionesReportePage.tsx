import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { KpiCard } from "./components/KpiCard";
import { RangoFechasPicker, rangoQueryParams, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteDevoluciones, type DevolucionReporte } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<DevolucionReporte>[] = [
  { key: "fecha", header: "Fecha", render: (d) => new Date(d.fecha).toLocaleString("es-AR") },
  { key: "ventaOriginal", header: "Venta original", ordenable: false, render: (d) => d.ventaOriginal },
  { key: "cliente", header: "Cliente", ordenable: false, render: (d) => d.cliente },
  { key: "tipo", header: "Tipo", ordenable: false, render: (d) => d.tipo },
  {
    key: "montoReintegro",
    header: "Monto reintegro",
    align: "right",
    render: (d) => `$${formatearMoneda(d.montoReintegro)}`,
  },
  { key: "motivo", header: "Motivo", ordenable: false, render: (d) => d.motivo },
  { key: "usuario", header: "Usuario", ordenable: false, render: (d) => d.usuario },
];

export function DevolucionesReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "fecha",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    ...rangoQueryParams(rango),
    busqueda: busqueda || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna === "fecha" ? "createdAt" : orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteDevoluciones(filtros);

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
        `/reportes/devoluciones/exportar.${formato}`,
        { ...rangoQueryParams(rango), busqueda: busqueda || undefined },
        `reporte-devoluciones.${formato}`,
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
        <RangoFechasPicker
          value={rango}
          onChange={(v) => {
            setRango(v);
            setPagina(1);
          }}
        />
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

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Cantidad de devoluciones" valor={String(data.resumen.cantidadDevoluciones)} />
          <KpiCard label="Monto total reintegrado" valor={`$${formatearMoneda(data.resumen.montoTotalReintegrado)}`} />
        </div>
      )}

      <EstadoConsulta
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && (data?.datos.length ?? 0) === 0}
        onReintentar={() => refetch()}
        vacioTitulo="Sin devoluciones en este período"
        vacioMensaje="Probá ampliar el rango de fechas o cambiar la búsqueda."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(d) => d.id}
          orden={orden}
          onOrdenar={ordenarPor}
          busqueda={{
            valor: busqueda,
            onCambiar: (v) => {
              setBusqueda(v);
              setPagina(1);
            },
            placeholder: "Buscar por cliente, usuario o motivo",
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
