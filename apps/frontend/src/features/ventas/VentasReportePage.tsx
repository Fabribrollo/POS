import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "@/features/reportes/components/EstadoConsulta";
import { ExportarBotones } from "@/features/reportes/components/ExportarBotones";
import { RangoFechasPicker, rangoUltimosDias, type RangoFechasValor } from "@/features/reportes/components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "@/features/reportes/components/TablaOrdenable";
import { descargarExportacion, useReporteVentas, type VentaReporte } from "@/features/reportes/reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<VentaReporte>[] = [
  { key: "numero", header: "Número", render: (v) => v.numero },
  { key: "fecha", header: "Fecha", render: (v) => new Date(v.fecha).toLocaleString("es-AR") },
  { key: "cliente", header: "Cliente", render: (v) => v.cliente, ordenable: false },
  { key: "vendedor", header: "Vendedor", render: (v) => v.vendedor, ordenable: false },
  { key: "mediosPago", header: "Medios de pago", render: (v) => v.mediosPago, ordenable: false },
  { key: "total", header: "Total", align: "right", render: (v) => `$${formatearMoneda(v.total)}` },
];

export function VentasReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "fecha",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    desde: rango.desde,
    hasta: rango.hasta,
    busqueda: busqueda || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna === "fecha" ? "createdAt" : orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteVentas(filtros);

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
        `/reportes/ventas/exportar.${formato}`,
        { desde: rango.desde, hasta: rango.hasta, busqueda: busqueda || undefined },
        `reporte-ventas.${formato}`,
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

      <EstadoConsulta
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && (data?.datos.length ?? 0) === 0}
        onReintentar={() => refetch()}
        vacioTitulo="Sin ventas en este período"
        vacioMensaje="Probá ampliar el rango de fechas o cambiar la búsqueda."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(v) => v.id}
          orden={orden}
          onOrdenar={ordenarPor}
          busqueda={{ valor: busqueda, onCambiar: (v) => { setBusqueda(v); setPagina(1); }, placeholder: "Buscar por número, cliente o vendedor" }}
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
