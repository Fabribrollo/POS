import { Router } from "express";
import { anularVentaSchema, crearVentaSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  anularController,
  buscarController,
  crearController,
  listarController,
} from "./ventas.controller.js";

export const ventasRouter: Router = Router();

ventasRouter.use(authGuard);

const vender = roleGuard("VENTAS_CREAR");

ventasRouter.get("/", vender, asyncHandler(listarController));
ventasRouter.get("/:id", vender, asyncHandler(buscarController));
ventasRouter.post("/", vender, validate(crearVentaSchema), asyncHandler(crearController));
ventasRouter.post(
  "/:id/anular",
  roleGuard("VENTAS_ANULAR"),
  validate(anularVentaSchema),
  asyncHandler(anularController),
);
