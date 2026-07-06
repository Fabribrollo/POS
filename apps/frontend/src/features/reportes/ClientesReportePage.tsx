import { useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { RangoFechasPicker, rangoQueryParams, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useReporteClientes, type ClienteReporte } from "./reportes.api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useHistorialCompras } from "@/features/clientes/clientes.api";
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
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteReporte | null>(null);

  const historial = useHistorialCompras(clienteSeleccionado?.id ?? null);

  const filtros = {
    ...rangoQueryParams(rango),
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
        { ...rangoQueryParams(rango), busqueda: busqueda || undefined },
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
          onFilaClick={setClienteSeleccionado}
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

      <Dialog open={clienteSeleccionado != null} onOpenChange={(v) => !v && setClienteSeleccionado(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compras de {clienteSeleccionado?.nombre}</DialogTitle>
          </DialogHeader>

          {historial.isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {historial.error && (
            <p className="text-sm text-destructive">{extraerMensajeError(historial.error)}</p>
          )}
          {historial.data && historial.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Este cliente todavía no tiene compras registradas.</p>
          )}
          {historial.data && historial.data.length > 0 && (
            <div className="space-y-4">
              {historial.data.map((compra) => (
                <div key={compra.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Venta {compra.numero}</span>
                    <span className="text-muted-foreground">
                      {new Date(compra.createdAt).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {compra.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.cantidad} x {item.producto.nombre}
                          {item.variante ? ` (${item.variante.nombre})` : ""}
                        </span>
                        <span>${formatearMoneda(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {compra.pagos.map((p) => p.medioPago.nombre).join(", ")}
                    </span>
                    <span className="font-semibold">${formatearMoneda(compra.total)}</span>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
