import { useState } from "react";
import { toast } from "sonner";
import { KpiCard } from "@/features/reportes/components/KpiCard";
import { EstadoConsulta } from "@/features/reportes/components/EstadoConsulta";
import { ExportarBotones } from "@/features/reportes/components/ExportarBotones";
import { RangoFechasPicker, rangoUltimosDias, type RangoFechasValor } from "@/features/reportes/components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "@/features/reportes/components/TablaOrdenable";
import { descargarExportacion, useReporteCaja, type CajaReporte } from "@/features/reportes/reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<CajaReporte>[] = [
  { key: "fechaApertura", header: "Apertura", render: (c) => new Date(c.fechaApertura).toLocaleString("es-AR") },
  {
    key: "fechaCierre",
    header: "Cierre",
    ordenable: false,
    render: (c) => (c.fechaCierre ? new Date(c.fechaCierre).toLocaleString("es-AR") : "-"),
  },
  { key: "usuarioApertura", header: "Abrió", ordenable: false, render: (c) => c.usuarioApertura },
  { key: "usuarioCierre", header: "Cerró", ordenable: false, render: (c) => c.usuarioCierre ?? "-" },
  {
    key: "montoApertura",
    header: "Monto apertura",
    align: "right",
    render: (c) => `$${formatearMoneda(c.montoApertura)}`,
  },
  {
    key: "diferencia",
    header: "Diferencia",
    align: "right",
    render: (c) => (c.diferencia != null ? `$${formatearMoneda(c.diferencia)}` : "-"),
  },
  { key: "estado", header: "Estado", ordenable: false, render: (c) => c.estado },
];

export function CajaReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "fechaApertura",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    desde: rango.desde,
    hasta: rango.hasta,
    busqueda: busqueda || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteCaja(filtros);

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
        `/reportes/caja/exportar.${formato}`,
        { desde: rango.desde, hasta: rango.hasta, busqueda: busqueda || undefined },
        `reporte-caja.${formato}`,
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <KpiCard label="Cantidad de cajas" valor={String(data.resumen.cantidadCajas)} />
          <KpiCard label="Diferencia total" valor={`$${formatearMoneda(data.resumen.diferenciaTotal)}`} />
        </div>
      )}

      <EstadoConsulta
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && (data?.datos.length ?? 0) === 0}
        onReintentar={() => refetch()}
        vacioTitulo="Sin cajas en este período"
        vacioMensaje="Probá ampliar el rango de fechas o cambiar la búsqueda."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(c) => c.id}
          orden={orden}
          onOrdenar={ordenarPor}
          busqueda={{
            valor: busqueda,
            onCambiar: (v) => {
              setBusqueda(v);
              setPagina(1);
            },
            placeholder: "Buscar por usuario",
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
