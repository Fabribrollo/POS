import { Router, type Request, type Response } from "express";
import type { ZodSchema } from "zod";
import {
  paginacionQuerySchema,
  productosMasVendidosQuerySchema,
  productosSinMovimientoQuerySchema,
  rangoFechasQuerySchema,
  reporteQuerySchema,
} from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validateQuery } from "../../core/middlewares/validate.js";
import * as controller from "./reportes.controller.js";

export const reportesRouter: Router = Router();

reportesRouter.use(authGuard, roleGuard("REPORTES_VER"));

// Cada reporte "de lista" son siempre las mismas 3 rutas (listar + exportar
// excel/pdf) validadas con el mismo schema de query: evita repetir el
// registro 7 veces.
type ControllerAsync = (req: Request, res: Response) => Promise<void>;

function registrarReporte(
  path: string,
  schema: ZodSchema,
  handlers: { listar: ControllerAsync; excel: ControllerAsync; pdf: ControllerAsync },
) {
  reportesRouter.get(path, validateQuery(schema), asyncHandler(handlers.listar));
  reportesRouter.get(`${path}/exportar.xlsx`, validateQuery(schema), asyncHandler(handlers.excel));
  reportesRouter.get(`${path}/exportar.pdf`, validateQuery(schema), asyncHandler(handlers.pdf));
}

registrarReporte("/dashboard", rangoFechasQuerySchema, {
  listar: controller.dashboardController,
  excel: controller.exportarDashboardExcelController,
  pdf: controller.exportarDashboardPdfController,
});

registrarReporte("/ventas", reporteQuerySchema, {
  listar: controller.reporteVentasController,
  excel: controller.exportarVentasExcelController,
  pdf: controller.exportarVentasPdfController,
});

registrarReporte("/caja", reporteQuerySchema, {
  listar: controller.reporteCajaController,
  excel: controller.exportarCajaExcelController,
  pdf: controller.exportarCajaPdfController,
});

registrarReporte("/productos", reporteQuerySchema, {
  listar: controller.reporteProductosController,
  excel: controller.exportarProductosExcelController,
  pdf: controller.exportarProductosPdfController,
});

registrarReporte("/inventario", paginacionQuerySchema, {
  listar: controller.reporteInventarioController,
  excel: controller.exportarInventarioExcelController,
  pdf: controller.exportarInventarioPdfController,
});

registrarReporte("/clientes", reporteQuerySchema, {
  listar: controller.reporteClientesController,
  excel: controller.exportarClientesExcelController,
  pdf: controller.exportarClientesPdfController,
});

registrarReporte("/cajeros", reporteQuerySchema, {
  listar: controller.reporteCajerosController,
  excel: controller.exportarCajerosExcelController,
  pdf: controller.exportarCajerosPdfController,
});

registrarReporte("/medios-pago", reporteQuerySchema, {
  listar: controller.reporteMediosPagoController,
  excel: controller.exportarMediosPagoExcelController,
  pdf: controller.exportarMediosPagoPdfController,
});

registrarReporte("/ganancias", reporteQuerySchema, {
  listar: controller.reporteGananciasController,
  excel: controller.exportarGananciasExcelController,
  pdf: controller.exportarGananciasPdfController,
});

registrarReporte("/devoluciones", reporteQuerySchema, {
  listar: controller.reporteDevolucionesController,
  excel: controller.exportarDevolucionesExcelController,
  pdf: controller.exportarDevolucionesPdfController,
});

reportesRouter.get(
  "/ventas-por-periodo",
  validateQuery(rangoFechasQuerySchema),
  asyncHandler(controller.ventasPorPeriodoController),
);
reportesRouter.get(
  "/ventas-por-vendedor",
  validateQuery(rangoFechasQuerySchema),
  asyncHandler(controller.ventasPorVendedorController),
);
reportesRouter.get(
  "/productos-mas-vendidos",
  validateQuery(productosMasVendidosQuerySchema),
  asyncHandler(controller.productosMasVendidosController),
);
reportesRouter.get(
  "/rentabilidad",
  validateQuery(rangoFechasQuerySchema),
  asyncHandler(controller.rentabilidadController),
);
reportesRouter.get("/stock-valorizado", asyncHandler(controller.stockValorizadoController));
reportesRouter.get(
  "/productos-sin-movimiento",
  validateQuery(productosSinMovimientoQuerySchema),
  asyncHandler(controller.productosSinMovimientoController),
);
