import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

// Auto-refresh de todos los reportes: cada 60s, sin ser tan agresivo como
// para saturar al backend en un POS que puede quedar con la pantalla abierta
// todo el turno.
const INTERVALO_AUTO_REFRESH = 60_000;

function useReporte<T>(path: string, filtros: unknown) {
  return useQuery({
    queryKey: ["reportes", path, filtros],
    queryFn: async () => (await api.get<T>(`/reportes/${path}`, { params: filtros })).data,
    refetchInterval: INTERVALO_AUTO_REFRESH,
  });
}

export interface RangoQuery {
  desde?: string;
  hasta?: string;
}

export interface PaginacionFiltros {
  pagina: number;
  porPagina: number;
  busqueda?: string;
  ordenarPor?: string;
  direccion: "asc" | "desc";
}

export interface FiltrosReporte extends RangoQuery, PaginacionFiltros {}

export interface RespuestaPaginada<T> {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

// ==================== Dashboard ====================

export interface KpisDashboard {
  totalVentas: number;
  cantidadVentas: number;
  ticketPromedio: number;
  gananciaNeta: number;
  variacionPorcentual: number | null;
  cajaAbierta: boolean;
}
export interface VentaPorDia {
  fecha: string;
  total: number;
}
export interface ProductoTop {
  productoId: number;
  nombre: string;
  codigoInterno?: string;
  cantidadVendida: number;
  totalVendido: number;
}
export interface DashboardResumen {
  rango: { desde: string; hasta: string };
  kpis: KpisDashboard;
  ventasPorDia: VentaPorDia[];
  topProductos: ProductoTop[];
}

export function useDashboard(rango: RangoQuery) {
  return useReporte<DashboardResumen>("dashboard", rango);
}

// ==================== Ventas ====================

export interface VentaReporte {
  id: number;
  numero: string;
  fecha: string;
  cliente: string;
  vendedor: string;
  mediosPago: string;
  total: number;
}

export function useReporteVentas(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<VentaReporte>>("ventas", filtros);
}

// ==================== Caja ====================

export interface CajaReporte {
  id: number;
  fechaApertura: string;
  fechaCierre: string | null;
  usuarioApertura: string;
  usuarioCierre: string | null;
  montoApertura: number;
  montoCierreDeclarado: number | null;
  montoCierreSistema: number | null;
  diferencia: number | null;
  estado: string;
  cantidadVentas: number;
  cantidadMovimientos: number;
}
export interface ResumenCaja {
  diferenciaTotal: number;
  cantidadCajas: number;
}

export function useReporteCaja(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<CajaReporte> & { resumen: ResumenCaja }>("caja", filtros);
}

// ==================== Productos ====================

export interface ProductoReporte {
  productoId: number;
  nombre: string;
  codigoInterno: string;
  cantidadVendida: number;
  totalVendido: number;
}

export function useReporteProductos(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<ProductoReporte>>("productos", filtros);
}

// ==================== Inventario ====================

export interface InventarioItem {
  id: number;
  producto: string;
  categoria: string;
  marca: string;
  cantidad: number;
  stockBajo: boolean;
  valorCosto: number;
  valorVenta: number;
}
export interface ResumenInventario {
  totalValorCosto: number;
  totalValorVenta: number;
}

export function useReporteInventario(filtros: PaginacionFiltros) {
  return useReporte<RespuestaPaginada<InventarioItem> & { resumen: ResumenInventario }>(
    "inventario",
    filtros,
  );
}

// ==================== Clientes ====================

export interface ClienteReporte {
  id: number;
  nombre: string;
  documento: string | null;
  cantidadCompras: number;
  totalComprado: number;
  saldoCuentaCorriente: number;
}

export function useReporteClientes(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<ClienteReporte>>("clientes", filtros);
}

// ==================== Cajeros ====================

export interface CajeroReporte {
  id: number;
  nombre: string;
  rol: string;
  cantidadVentas: number;
  totalVendido: number;
  cantidadCajas: number;
  diferenciaCajas: number;
}

export function useReporteCajeros(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<CajeroReporte>>("cajeros", filtros);
}

// ==================== Métodos de pago ====================

export interface MedioPagoReporte {
  medioPagoId: number;
  nombre: string;
  cantidadTransacciones: number;
  totalCobrado: number;
  porcentaje: number;
}

export function useReporteMediosPago(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<MedioPagoReporte>>("medios-pago", filtros);
}

// ==================== Ganancias ====================

export interface GananciaProducto {
  productoId: number;
  nombre: string;
  cantidadVendida: number;
  totalVendido: number;
  costoTotal: number;
  margen: number;
  margenPorcentual: number;
}
export interface ResumenGanancias {
  totalVentas: number;
  costoMercaderiaVendida: number;
  gananciaBruta: number;
  gastosOperativos: number;
  gananciaNeta: number;
}

export function useReporteGanancias(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<GananciaProducto> & { resumen: ResumenGanancias }>(
    "ganancias",
    filtros,
  );
}

// ==================== Devoluciones ====================

export interface DevolucionReporte {
  id: number;
  fecha: string;
  ventaOriginal: string;
  cliente: string;
  tipo: string;
  montoReintegro: number;
  motivo: string;
  usuario: string;
}
export interface ResumenDevoluciones {
  cantidadDevoluciones: number;
  montoTotalReintegrado: number;
}

export function useReporteDevoluciones(filtros: FiltrosReporte) {
  return useReporte<RespuestaPaginada<DevolucionReporte> & { resumen: ResumenDevoluciones }>(
    "devoluciones",
    filtros,
  );
}

// ==================== Exportación ====================

// Mismo patrón que descargarPlantillaProductos: el archivo lo arma el
// backend, acá solo se dispara la descarga del blob.
export async function descargarExportacion(
  url: string,
  params: Record<string, unknown>,
  nombreArchivo: string,
) {
  const res = await api.get(url, { params, responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(blobUrl);
}
