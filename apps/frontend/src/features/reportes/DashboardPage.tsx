import { useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { EstadoConsulta } from "./components/EstadoConsulta";
import { ExportarBotones } from "./components/ExportarBotones";
import { KpiCard } from "./components/KpiCard";
import { RangoFechasPicker, rangoUltimosDias, type RangoFechasValor } from "./components/RangoFechasPicker";
import { type ColumnaTabla, TablaOrdenable } from "./components/TablaOrdenable";
import { descargarExportacion, useDashboard, type ProductoTop } from "./reportes.api";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";

const COLUMNAS_TOP: ColumnaTabla<ProductoTop>[] = [
  { key: "nombre", header: "Producto", ordenable: false, render: (p) => p.nombre },
  {
    key: "cantidadVendida",
    header: "Cantidad",
    align: "right",
    ordenable: false,
    render: (p) => String(p.cantidadVendida),
  },
  {
    key: "totalVendido",
    header: "Total vendido",
    align: "right",
    ordenable: false,
    render: (p) => `$${formatearMoneda(p.totalVendido)}`,
  },
];

export function DashboardPage() {
  const [rango, setRango] = useState<RangoFechasValor>(rangoUltimosDias(30));
  const [exportando, setExportando] = useState(false);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useDashboard(rango);

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(true);
    try {
      await descargarExportacion(
        `/reportes/dashboard/exportar.${formato}`,
        { desde: rango.desde, hasta: rango.hasta },
        `dashboard.${formato}`,
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
            {isFetching
              ? "Actualizando..."
              : `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString("es-AR")}`}
          </span>
          <ExportarBotones
            onExportarExcel={() => exportar("xlsx")}
            onExportarPdf={() => exportar("pdf")}
            exportando={exportando}
          />
        </div>
      </div>

      <EstadoConsulta isLoading={isLoading} error={error} onReintentar={() => refetch()}>
        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                label="Ventas totales"
                valor={`$${formatearMoneda(data.kpis.totalVentas)}`}
                variacion={data.kpis.variacionPorcentual}
                icon={DollarSign}
              />
              <KpiCard
                label="Cantidad de ventas"
                valor={String(data.kpis.cantidadVentas)}
                icon={ShoppingCart}
              />
              <KpiCard
                label="Ticket promedio"
                valor={`$${formatearMoneda(data.kpis.ticketPromedio)}`}
                icon={Receipt}
              />
              <KpiCard
                label="Ganancia neta"
                valor={`$${formatearMoneda(data.kpis.gananciaNeta)}`}
                icon={TrendingUp}
              />
              <KpiCard label="Caja" valor={data.kpis.cajaAbierta ? "Abierta" : "Cerrada"} icon={Wallet} />
            </div>

            <div className="rounded-lg border p-4">
              <h2 className="mb-3 text-sm font-medium">Ventas por día</h2>
              {data.ventasPorDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.ventasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => [`$${formatearMoneda(Number(value))}`, "Total"]} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium">Top 5 productos</h2>
              <TablaOrdenable
                columnas={COLUMNAS_TOP}
                filas={data.topProductos}
                claveFila={(p) => p.productoId}
              />
            </div>
          </div>
        )}
      </EstadoConsulta>
    </div>
  );
}
