import { Router } from "express";
import { abrirCajaSchema, cerrarCajaSchema, movimientoCajaSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  abrirController,
  cerrarController,
  historialController,
  listarMovimientosController,
  movimientoController,
  obtenerAbiertaController,
} from "./caja.controller.js";

export const cajaRouter: Router = Router();

cajaRouter.use(authGuard);

const operar = roleGuard("CAJA_ABRIR_CERRAR");

cajaRouter.get("/abierta", operar, asyncHandler(obtenerAbiertaController));
cajaRouter.post("/abrir", operar, validate(abrirCajaSchema), asyncHandler(abrirController));
cajaRouter.post("/cerrar", operar, validate(cerrarCajaSchema), asyncHandler(cerrarController));
cajaRouter.post(
  "/movimientos",
  operar,
  validate(movimientoCajaSchema),
  asyncHandler(movimientoController),
);
cajaRouter.get("/:id/movimientos", operar, asyncHandler(listarMovimientosController));
cajaRouter.get("/historial", roleGuard("REPORTES_VER"), asyncHandler(historialController));
