import { Router } from "express";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import {
  productosMasVendidosController,
  productosSinMovimientoController,
  rentabilidadController,
  stockValorizadoController,
  ventasPorPeriodoController,
  ventasPorVendedorController,
} from "./reportes.controller.js";

export const reportesRouter: Router = Router();

reportesRouter.use(authGuard, roleGuard("REPORTES_VER"));

reportesRouter.get("/ventas-por-periodo", asyncHandler(ventasPorPeriodoController));
reportesRouter.get("/ventas-por-vendedor", asyncHandler(ventasPorVendedorController));
reportesRouter.get("/productos-mas-vendidos", asyncHandler(productosMasVendidosController));
reportesRouter.get("/rentabilidad", asyncHandler(rentabilidadController));
reportesRouter.get("/stock-valorizado", asyncHandler(stockValorizadoController));
reportesRouter.get("/productos-sin-movimiento", asyncHandler(productosSinMovimientoController));
