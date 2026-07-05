import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { RangoFechasPicker, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteMediosPago, type MedioPagoReporte } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<MedioPagoReporte>[] = [
  { key: "nombre", header: "Medio de pago", render: (m) => m.nombre },
  {
    key: "cantidadTransacciones",
    header: "Transacciones",
    align: "right",
    render: (m) => String(m.cantidadTransacciones),
  },
  {
    key: "totalCobrado",
    header: "Total cobrado",
    align: "right",
    render: (m) => `$${formatearMoneda(m.totalCobrado)}`,
  },
  {
    key: "porcentaje",
    header: "% del total",
    align: "right",
    ordenable: false,
    render: (m) => `${m.porcentaje.toFixed(1)}%`,
  },
];

// Son pocos medios de pago fijos (EFECTIVO, DEBITO, ...): no tiene sentido
// una búsqueda acá, por eso no se le pasa `busqueda` a la tabla.
export function MediosPagoReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "totalCobrado",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    desde: rango.desde,
    hasta: rango.hasta,
    pagina: 1,
    porPagina: 50,
    ordenarPor: orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteMediosPago(filtros);

  function ordenarPor(columna: string) {
    setOrden((actual) =>
      actual.columna === columna
        ? { columna, direccion: actual.direccion === "asc" ? "desc" : "asc" }
        : { columna, direccion: "asc" },
    );
  }

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(true);
    try {
      await descargarExportacion(
        `/reportes/medios-pago/exportar.${formato}`,
        { desde: rango.desde, hasta: rango.hasta },
        `reporte-medios-pago.${formato}`,
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
        <RangoFechasPicker value={rango} onChange={setRango} />
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
        vacioTitulo="Sin cobros en este período"
        vacioMensaje="Probá ampliar el rango de fechas."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(m) => m.medioPagoId}
          orden={orden}
          onOrdenar={ordenarPor}
        />
      </EstadoConsulta>
    </div>
  );
}
