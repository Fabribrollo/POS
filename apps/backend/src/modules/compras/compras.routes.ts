import { Router } from "express";
import { crearCompraSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  anularController,
  buscarController,
  crearController,
  listarController,
  recibirController,
} from "./compras.controller.js";

export const comprasRouter: Router = Router();

comprasRouter.use(authGuard);

const leer = roleGuard("COMPRAS_LEER");
const gestionar = roleGuard("COMPRAS_GESTIONAR");

comprasRouter.get("/", leer, asyncHandler(listarController));
comprasRouter.get("/:id", leer, asyncHandler(buscarController));
comprasRouter.post("/", gestionar, validate(crearCompraSchema), asyncHandler(crearController));
comprasRouter.post("/:id/recibir", gestionar, asyncHandler(recibirController));
comprasRouter.post("/:id/anular", gestionar, asyncHandler(anularController));
