import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { KpiCard } from "./components/KpiCard";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteInventario, type InventarioItem } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS: ColumnaTabla<InventarioItem>[] = [
  { key: "producto", header: "Producto", ordenable: false, render: (i) => i.producto },
  { key: "categoria", header: "Categoría", ordenable: false, render: (i) => i.categoria },
  { key: "marca", header: "Marca", ordenable: false, render: (i) => i.marca },
  {
    key: "cantidad",
    header: "Cantidad",
    align: "right",
    render: (i) => (
      <span className="inline-flex items-center gap-2">
        {i.cantidad}
        {i.stockBajo && (
          <Badge variant="destructive" className="text-[10px]">
            Stock bajo
          </Badge>
        )}
      </span>
    ),
  },
  {
    key: "valorCosto",
    header: "Valor costo",
    align: "right",
    ordenable: false,
    render: (i) => `$${formatearMoneda(i.valorCosto)}`,
  },
  {
    key: "valorVenta",
    header: "Valor venta",
    align: "right",
    ordenable: false,
    render: (i) => `$${formatearMoneda(i.valorVenta)}`,
  },
];

// Inventario es una foto del stock actual: no tiene selector de rango de
// fechas (a diferencia del resto de los reportes).
export function InventarioReportePage() {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<{ columna: string; direccion: "asc" | "desc" }>({
    columna: "cantidad",
    direccion: "desc",
  });
  const [exportando, setExportando] = useState(false);

  const filtros = {
    busqueda: busqueda || undefined,
    pagina,
    porPagina: 20,
    ordenarPor: orden.columna,
    direccion: orden.direccion,
  };

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useReporteInventario(filtros);

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
        `/reportes/inventario/exportar.${formato}`,
        { busqueda: busqueda || undefined },
        `reporte-inventario.${formato}`,
      );
    } catch (err) {
      toast.error(extraerMensajeError(err));
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground no-imprimir">
          {isFetching ? "Actualizando..." : `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString("es-AR")}`}
        </span>
        <ExportarBotones
          onExportarExcel={() => exportar("xlsx")}
          onExportarPdf={() => exportar("pdf")}
          exportando={exportando}
        />
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Valor costo total" valor={`$${formatearMoneda(data.resumen.totalValorCosto)}`} />
          <KpiCard label="Valor venta total" valor={`$${formatearMoneda(data.resumen.totalValorVenta)}`} />
        </div>
      )}

      <EstadoConsulta
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && (data?.datos.length ?? 0) === 0}
        onReintentar={() => refetch()}
        vacioTitulo="Sin stock cargado"
        vacioMensaje="Todavía no hay movimientos de stock para mostrar."
      >
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={data?.datos ?? []}
          claveFila={(i) => i.id}
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
