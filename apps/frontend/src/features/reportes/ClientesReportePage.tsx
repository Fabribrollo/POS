import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { RangoFechasPicker, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteClientes, type ClienteReporte } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<ClienteReporte>[] = [
  { key: "nombre", header: "Cliente", render: (c) => c.nombre },
  { key: "documento", header: "Documento", ordenable: false, render: (c) => c.documento ?? "-" },
  {
    key: "cantidadCompras",
    header: "Compras",
    align: "right",
    ordenable: false,
    render: (c) => String(c.cantidadCompras),
  },
  {
    key: "totalComprado",
    header: "Total comprado",
    align: "right",
    ordenable: false,
    render: (c) => `$${formatearMoneda(c.totalComprado)}`,
  },
  {
    key: "saldoCuentaCorriente",
    header: "Saldo cta. cte.",
    align: "right",
    ordenable: false,
    render: (c) => `$${formatearMoneda(c.saldoCuentaCorriente)}`,
  },
];

export function ClientesReportePage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "nombre",
    direccion: "asc",
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

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteClientes(filtros);

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
        `/reportes/clientes/exportar.${formato}`,
        { desde: rango.desde, hasta: rango.hasta, busqueda: busqueda || undefined },
        `reporte-clientes.${formato}`,
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
        vacioTitulo="Sin clientes"
        vacioMensaje="Probá cambiar la búsqueda."
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
            placeholder: "Buscar por nombre o documento",
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
