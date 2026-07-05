import type { Request, Response } from "express";
import type {
  PaginacionQuery,
  ProductosMasVendidosQuery,
  ProductosSinMovimientoQuery,
  RangoFechasQuery,
  ReporteQuery,
} from "@pos/shared";
import type { ColumnaExport, ResumenExport } from "./reportes.exportar.js";
import { generarExcel, generarPdf } from "./reportes.exportar.js";
import * as reportesService from "./reportes.service.js";

function query<T>(req: Request): T {
  return req.queryValidado as T;
}

export async function ventasPorPeriodoController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.ventasPorPeriodo(query<RangoFechasQuery>(req)));
}

export async function ventasPorVendedorController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.ventasPorVendedor(query<RangoFechasQuery>(req)));
}

export async function productosMasVendidosController(req: Request, res: Response): Promise<void> {
  const { take, ...rango } = query<ProductosMasVendidosQuery>(req);
  res.json(await reportesService.productosMasVendidos(rango, take));
}

export async function rentabilidadController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.rentabilidad(query<RangoFechasQuery>(req)));
}

export async function stockValorizadoController(_req: Request, res: Response): Promise<void> {
  res.json(await reportesService.stockValorizado());
}

export async function productosSinMovimientoController(
  req: Request,
  res: Response,
): Promise<void> {
  const { dias } = query<ProductosSinMovimientoQuery>(req);
  res.json(await reportesService.productosSinMovimiento(dias));
}

export async function dashboardController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.dashboard(query<RangoFechasQuery>(req)));
}

export async function reporteVentasController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteVentas(query<ReporteQuery>(req)));
}

export async function reporteCajaController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteCaja(query<ReporteQuery>(req)));
}

export async function reporteProductosController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteProductos(query<ReporteQuery>(req)));
}

export async function reporteInventarioController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteInventario(query<PaginacionQuery>(req)));
}

export async function reporteClientesController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteClientes(query<ReporteQuery>(req)));
}

export async function reporteCajerosController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteCajeros(query<ReporteQuery>(req)));
}

export async function reporteMediosPagoController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteMediosPago(query<ReporteQuery>(req)));
}

export async function reporteGananciasController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteGanancias(query<ReporteQuery>(req)));
}

export async function reporteDevolucionesController(req: Request, res: Response): Promise<void> {
  res.json(await reportesService.reporteDevoluciones(query<ReporteQuery>(req)));
}

// ==================== Exportación ====================
//
// Todos los export bajan el reporte filtrado completo (hasta 10.000 filas),
// no solo la página que se está viendo en pantalla — es lo que un usuario
// espera de "exportar". `crearExportadores` arma el par excel/pdf una sola
// vez por reporte a partir de una función que devuelve las filas ya
// formateadas para mostrar (fechas legibles, etc.) + un resumen opcional de
// KPIs, evitando repetir el manejo de headers/response en cada reporte.

interface DatosExport {
  filas: Record<string, unknown>[];
  resumen?: ResumenExport[];
}

function crearExportadores<Q>(
  archivo: string,
  hoja: string,
  columnas: ColumnaExport[],
  obtenerDatos: (q: Q) => Promise<DatosExport>,
) {
  return {
    excel: async (req: Request, res: Response): Promise<void> => {
      const { filas } = await obtenerDatos(query<Q>(req));
      const buffer = generarExcel(hoja, columnas, filas);
      res
        .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .set("Content-Disposition", `attachment; filename="${archivo}.xlsx"`)
        .send(buffer);
    },
    pdf: async (req: Request, res: Response): Promise<void> => {
      const { filas, resumen } = await obtenerDatos(query<Q>(req));
      const buffer = await generarPdf(hoja, columnas, filas, resumen ?? []);
      res
        .set("Content-Type", "application/pdf")
        .set("Content-Disposition", `attachment; filename="${archivo}.pdf"`)
        .send(buffer);
    },
  };
}

const FILAS_EXPORT = { pagina: 1, porPagina: 10000 } as const;

// ---- Dashboard ----
const exportDashboard = crearExportadores<RangoFechasQuery>(
  "dashboard",
  "Ventas por día",
  [
    { header: "Fecha", key: "fecha" },
    { header: "Total vendido", key: "total" },
  ],
  async (rango) => {
    const d = await reportesService.dashboard(rango);
    return {
      filas: d.ventasPorDia,
      resumen: [
        { label: "Ventas totales", valor: d.kpis.totalVentas.toFixed(2) },
        { label: "Cantidad de ventas", valor: String(d.kpis.cantidadVentas) },
        { label: "Ticket promedio", valor: d.kpis.ticketPromedio.toFixed(2) },
        { label: "Ganancia neta", valor: d.kpis.gananciaNeta.toFixed(2) },
      ],
    };
  },
);
export const exportarDashboardExcelController = exportDashboard.excel;
export const exportarDashboardPdfController = exportDashboard.pdf;

// ---- Ventas ----
const exportVentas = crearExportadores<ReporteQuery>(
  "reporte-ventas",
  "Ventas",
  [
    { header: "Número", key: "numero" },
    { header: "Fecha", key: "fecha" },
    { header: "Cliente", key: "cliente" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Medios de pago", key: "mediosPago" },
    { header: "Total", key: "total" },
  ],
  async (q) => {
    const { datos } = await reportesService.reporteVentas({ ...q, ...FILAS_EXPORT });
    const filas = datos.map((v) => ({ ...v, fecha: new Date(v.fecha).toLocaleString("es-AR") }));
    const total = filas.reduce((acc, f) => acc + f.total, 0);
    return {
      filas,
      resumen: [
        { label: "Cantidad de ventas", valor: String(filas.length) },
        { label: "Total del período", valor: total.toFixed(2) },
      ],
    };
  },
);
export const exportarVentasExcelController = exportVentas.excel;
export const exportarVentasPdfController = exportVentas.pdf;

// ---- Caja ----
const exportCaja = crearExportadores<ReporteQuery>(
  "reporte-caja",
  "Caja",
  [
    { header: "Apertura", key: "fechaApertura" },
    { header: "Cierre", key: "fechaCierre" },
    { header: "Abrió", key: "usuarioApertura" },
    { header: "Cerró", key: "usuarioCierre" },
    { header: "Monto apertura", key: "montoApertura" },
    { header: "Monto sistema", key: "montoCierreSistema" },
    { header: "Monto declarado", key: "montoCierreDeclarado" },
    { header: "Diferencia", key: "diferencia" },
    { header: "Estado", key: "estado" },
  ],
  async (q) => {
    const { datos, resumen } = await reportesService.reporteCaja({ ...q, ...FILAS_EXPORT });
    return {
      filas: datos.map((c) => ({
        ...c,
        fechaApertura: new Date(c.fechaApertura).toLocaleString("es-AR"),
        fechaCierre: c.fechaCierre ? new Date(c.fechaCierre).toLocaleString("es-AR") : "-",
        usuarioCierre: c.usuarioCierre ?? "-",
        montoCierreSistema: c.montoCierreSistema ?? "-",
        montoCierreDeclarado: c.montoCierreDeclarado ?? "-",
        diferencia: c.diferencia ?? "-",
      })),
      resumen: [
        { label: "Cantidad de cajas", valor: String(resumen.cantidadCajas) },
        { label: "Diferencia total", valor: resumen.diferenciaTotal.toFixed(2) },
      ],
    };
  },
);
export const exportarCajaExcelController = exportCaja.excel;
export const exportarCajaPdfController = exportCaja.pdf;

// ---- Productos ----
const exportProductos = crearExportadores<ReporteQuery>(
  "reporte-productos",
  "Productos",
  [
    { header: "Producto", key: "nombre" },
    { header: "Código", key: "codigoInterno" },
    { header: "Cantidad vendida", key: "cantidadVendida" },
    { header: "Total vendido", key: "totalVendido" },
  ],
  async (q) => {
    const { datos } = await reportesService.reporteProductos({ ...q, ...FILAS_EXPORT });
    const totalUnidades = datos.reduce((acc, f) => acc + f.cantidadVendida, 0);
    const totalVendido = datos.reduce((acc, f) => acc + f.totalVendido, 0);
    return {
      filas: datos,
      resumen: [
        { label: "Productos distintos", valor: String(datos.length) },
        { label: "Unidades vendidas", valor: String(totalUnidades) },
        { label: "Total facturado", valor: totalVendido.toFixed(2) },
      ],
    };
  },
);
export const exportarProductosExcelController = exportProductos.excel;
export const exportarProductosPdfController = exportProductos.pdf;

// ---- Inventario ----
const exportInventario = crearExportadores<PaginacionQuery>(
  "reporte-inventario",
  "Inventario",
  [
    { header: "Producto", key: "producto" },
    { header: "Categoría", key: "categoria" },
    { header: "Marca", key: "marca" },
    { header: "Cantidad", key: "cantidad" },
    { header: "Valor costo", key: "valorCosto" },
    { header: "Valor venta", key: "valorVenta" },
  ],
  async (q) => {
    const { datos, resumen } = await reportesService.reporteInventario({ ...q, ...FILAS_EXPORT });
    return {
      filas: datos,
      resumen: [
        { label: "Valor costo total", valor: resumen.totalValorCosto.toFixed(2) },
        { label: "Valor venta total", valor: resumen.totalValorVenta.toFixed(2) },
      ],
    };
  },
);
export const exportarInventarioExcelController = exportInventario.excel;
export const exportarInventarioPdfController = exportInventario.pdf;

// ---- Clientes ----
const exportClientes = crearExportadores<ReporteQuery>(
  "reporte-clientes",
  "Clientes",
  [
    { header: "Cliente", key: "nombre" },
    { header: "Documento", key: "documento" },
    { header: "Cantidad de compras", key: "cantidadCompras" },
    { header: "Total comprado", key: "totalComprado" },
    { header: "Saldo cta. cte.", key: "saldoCuentaCorriente" },
  ],
  async (q) => {
    const { datos } = await reportesService.reporteClientes({ ...q, ...FILAS_EXPORT });
    const totalComprado = datos.reduce((acc, f) => acc + f.totalComprado, 0);
    return {
      filas: datos.map((c) => ({ ...c, documento: c.documento ?? "-" })),
      resumen: [
        { label: "Clientes", valor: String(datos.length) },
        { label: "Total comprado", valor: totalComprado.toFixed(2) },
      ],
    };
  },
);
export const exportarClientesExcelController = exportClientes.excel;
export const exportarClientesPdfController = exportClientes.pdf;

// ---- Cajeros ----
const exportCajeros = crearExportadores<ReporteQuery>(
  "reporte-cajeros",
  "Cajeros",
  [
    { header: "Nombre", key: "nombre" },
    { header: "Rol", key: "rol" },
    { header: "Cantidad de ventas", key: "cantidadVentas" },
    { header: "Total vendido", key: "totalVendido" },
    { header: "Cantidad de cajas", key: "cantidadCajas" },
    { header: "Diferencia cajas", key: "diferenciaCajas" },
  ],
  async (q) => {
    const { datos } = await reportesService.reporteCajeros({ ...q, ...FILAS_EXPORT });
    const totalVendido = datos.reduce((acc, f) => acc + f.totalVendido, 0);
    return {
      filas: datos,
      resumen: [
        { label: "Cajeros", valor: String(datos.length) },
        { label: "Total vendido", valor: totalVendido.toFixed(2) },
      ],
    };
  },
);
export const exportarCajerosExcelController = exportCajeros.excel;
export const exportarCajerosPdfController = exportCajeros.pdf;

// ---- Métodos de pago ----
const exportMediosPago = crearExportadores<ReporteQuery>(
  "reporte-medios-pago",
  "Medios de pago",
  [
    { header: "Medio de pago", key: "nombre" },
    { header: "Cantidad de transacciones", key: "cantidadTransacciones" },
    { header: "Total cobrado", key: "totalCobrado" },
    { header: "% del total", key: "porcentaje" },
  ],
  async (q) => {
    const { datos } = await reportesService.reporteMediosPago({ ...q, ...FILAS_EXPORT });
    const totalCobrado = datos.reduce((acc, f) => acc + f.totalCobrado, 0);
    return {
      filas: datos.map((m) => ({ ...m, porcentaje: `${m.porcentaje.toFixed(1)}%` })),
      resumen: [{ label: "Total cobrado", valor: totalCobrado.toFixed(2) }],
    };
  },
);
export const exportarMediosPagoExcelController = exportMediosPago.excel;
export const exportarMediosPagoPdfController = exportMediosPago.pdf;

// ---- Ganancias ----
const exportGanancias = crearExportadores<ReporteQuery>(
  "reporte-ganancias",
  "Ganancias",
  [
    { header: "Producto", key: "nombre" },
    { header: "Cantidad vendida", key: "cantidadVendida" },
    { header: "Total vendido", key: "totalVendido" },
    { header: "Costo total", key: "costoTotal" },
    { header: "Margen", key: "margen" },
    { header: "Margen %", key: "margenPorcentual" },
  ],
  async (q) => {
    const { datos, resumen } = await reportesService.reporteGanancias({ ...q, ...FILAS_EXPORT });
    return {
      filas: datos.map((f) => ({ ...f, margenPorcentual: `${f.margenPorcentual.toFixed(1)}%` })),
      resumen: [
        { label: "Ventas totales", valor: resumen.totalVentas.toFixed(2) },
        { label: "Costo mercadería vendida", valor: resumen.costoMercaderiaVendida.toFixed(2) },
        { label: "Ganancia bruta", valor: resumen.gananciaBruta.toFixed(2) },
        { label: "Gastos operativos", valor: resumen.gastosOperativos.toFixed(2) },
        { label: "Ganancia neta", valor: resumen.gananciaNeta.toFixed(2) },
      ],
    };
  },
);
export const exportarGananciasExcelController = exportGanancias.excel;
export const exportarGananciasPdfController = exportGanancias.pdf;

// ---- Devoluciones ----
const exportDevoluciones = crearExportadores<ReporteQuery>(
  "reporte-devoluciones",
  "Devoluciones",
  [
    { header: "Fecha", key: "fecha" },
    { header: "Venta original", key: "ventaOriginal" },
    { header: "Cliente", key: "cliente" },
    { header: "Tipo", key: "tipo" },
    { header: "Monto reintegro", key: "montoReintegro" },
    { header: "Motivo", key: "motivo" },
    { header: "Usuario", key: "usuario" },
  ],
  async (q) => {
    const { datos, resumen } = await reportesService.reporteDevoluciones({ ...q, ...FILAS_EXPORT });
    return {
      filas: datos.map((d) => ({ ...d, fecha: new Date(d.fecha).toLocaleString("es-AR") })),
      resumen: [
        { label: "Cantidad de devoluciones", valor: String(resumen.cantidadDevoluciones) },
        { label: "Monto total reintegrado", valor: resumen.montoTotalReintegrado.toFixed(2) },
      ],
    };
  },
);
export const exportarDevolucionesExcelController = exportDevoluciones.excel;
export const exportarDevolucionesPdfController = exportDevoluciones.pdf;
