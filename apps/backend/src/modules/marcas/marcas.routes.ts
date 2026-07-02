import { Router } from "express";
import { actualizarMarcaSchema, crearMarcaSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  crearController,
  desactivarController,
  listarController,
} from "./marcas.controller.js";

export const marcasRouter: Router = Router();

marcasRouter.use(authGuard);

marcasRouter.get("/", roleGuard("PRODUCTOS_LEER"), asyncHandler(listarController));
marcasRouter.post(
  "/",
  roleGuard("PRODUCTOS_ESCRIBIR"),
  validate(crearMarcaSchema),
  asyncHandler(crearController),
);
marcasRouter.patch(
  "/:id",
  roleGuard("PRODUCTOS_ESCRIBIR"),
  validate(actualizarMarcaSchema),
  asyncHandler(actualizarController),
);
marcasRouter.delete("/:id", roleGuard("PRODUCTOS_ESCRIBIR"), asyncHandler(desactivarController));
