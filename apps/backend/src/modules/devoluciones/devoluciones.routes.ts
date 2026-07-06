import { Router } from "express";
import { crearDevolucionSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  buscarController,
  buscarPorNumeroController,
  crearController,
  listarPorVentaController,
} from "./devoluciones.controller.js";

export const devolucionesRouter: Router = Router();

devolucionesRouter.use(authGuard, roleGuard("DEVOLUCIONES_CREAR"));

devolucionesRouter.post("/", validate(crearDevolucionSchema), asyncHandler(crearController));
devolucionesRouter.get("/buscar/:numero", asyncHandler(buscarPorNumeroController));
devolucionesRouter.get("/venta/:ventaId", asyncHandler(listarPorVentaController));
devolucionesRouter.get("/:id", asyncHandler(buscarController));
