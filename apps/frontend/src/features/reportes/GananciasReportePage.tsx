import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { KpiCard } from "./components/KpiCard";
import { RangoFechasPicker, rangoQueryParams, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteGanancias, type GananciaProducto } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<GananciaProducto>[] = [
  { key: "nombre", header: "Producto", ordenable: false, render: (g) => g.nombre },
  {
    key: "cantidadVendida",
    header: "Cantidad",
    align: "right",
    render: (g) => String(g.cantidadVendida),
  },
  {
    key: "totalVendido",
    header: "Total vendido",
    align: "right",
    render: (g) => `$${formatearMoneda(g.totalVendido)}`,
  },
  {
    key: "costoTotal",
    header: "Costo total",
    align: "right",
    ordenable: false,
    render: (g) => `$${formatearMoneda(g.costoTotal)}`,
  },
  { key: "margen", header: "Margen", align: "right", render: (g) => `$${formatearMoneda(g.margen)}` },
  {
    key: "margenPorcentual",
    header: "Margen %",
    align: "right",
    render: (g) => `${g.margenPorcentual.toFixed(1)}%`,
  },
];

export function GananciasReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "margen",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    ...rangoQueryParams(rango),
    busqueda: busqueda || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteGanancias(filtros);

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
        `/reportes/ganancias/exportar.${formato}`,
        { ...rangoQueryParams(rango), busqueda: busqueda || undefined },
        `reporte-ganancias.${formato}`,
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Ventas totales" valor={`$${formatearMoneda(data.resumen.totalVentas)}`} />
          <KpiCard label="Costo mercadería" valor={`$${formatearMoneda(data.resumen.costoMercaderiaVendida)}`} />
          <KpiCard label="Ganancia bruta" valor={`$${formatearMoneda(data.resumen.gananciaBruta)}`} />
          <KpiCard label="Gastos operativos" valor={`$${formatearMoneda(data.resumen.gastosOperativos)}`} />
          <KpiCard label="Ganancia neta" valor={`$${formatearMoneda(data.resumen.gananciaNeta)}`} />
        </div>
      )}

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
          claveFila={(g) => g.productoId}
          orden={orden}
          onOrdenar={ordenarPor}
          busqueda={{
            valor: busqueda,
            onCambiar: (v) => {
              setBusqueda(v);
              setPagina(1);
            },
            placeholder: "Buscar por nombre de producto",
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
