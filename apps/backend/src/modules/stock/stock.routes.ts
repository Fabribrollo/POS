import { Router } from "express";
import { ajusteStockSchema, egresoStockSchema, ingresoStockSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  ajusteController,
  egresoController,
  ingresoController,
  listarMovimientosController,
  stockBajoController,
  stockDeProductoController,
} from "./stock.controller.js";

export const stockRouter: Router = Router();

stockRouter.use(authGuard);

const leer = roleGuard("STOCK_LEER");
const ajustar = roleGuard("STOCK_AJUSTAR");

stockRouter.get("/movimientos", leer, asyncHandler(listarMovimientosController));
stockRouter.get("/bajo", leer, asyncHandler(stockBajoController));
stockRouter.get("/producto/:productoId", leer, asyncHandler(stockDeProductoController));

stockRouter.post("/ingreso", ajustar, validate(ingresoStockSchema), asyncHandler(ingresoController));
stockRouter.post("/egreso", ajustar, validate(egresoStockSchema), asyncHandler(egresoController));
stockRouter.post("/ajuste", ajustar, validate(ajusteStockSchema), asyncHandler(ajusteController));
