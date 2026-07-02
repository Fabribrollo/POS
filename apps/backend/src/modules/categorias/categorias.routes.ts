import { Router } from "express";
import { actualizarCategoriaSchema, crearCategoriaSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  crearController,
  desactivarController,
  listarController,
} from "./categorias.controller.js";

export const categoriasRouter: Router = Router();

categoriasRouter.use(authGuard);

categoriasRouter.get("/", roleGuard("PRODUCTOS_LEER"), asyncHandler(listarController));
categoriasRouter.post(
  "/",
  roleGuard("PRODUCTOS_ESCRIBIR"),
  validate(crearCategoriaSchema),
  asyncHandler(crearController),
);
categoriasRouter.patch(
  "/:id",
  roleGuard("PRODUCTOS_ESCRIBIR"),
  validate(actualizarCategoriaSchema),
  asyncHandler(actualizarController),
);
categoriasRouter.delete(
  "/:id",
  roleGuard("PRODUCTOS_ESCRIBIR"),
  asyncHandler(desactivarController),
);
