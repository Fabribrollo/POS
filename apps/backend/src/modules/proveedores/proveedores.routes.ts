import { Router } from "express";
import { actualizarProveedorSchema, crearProveedorSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  buscarController,
  crearController,
  desactivarController,
  listarController,
} from "./proveedores.controller.js";

export const proveedoresRouter: Router = Router();

proveedoresRouter.use(authGuard);

const leer = roleGuard("COMPRAS_LEER");
const gestionar = roleGuard("COMPRAS_GESTIONAR");

proveedoresRouter.get("/", leer, asyncHandler(listarController));
proveedoresRouter.get("/:id", leer, asyncHandler(buscarController));
proveedoresRouter.post(
  "/",
  gestionar,
  validate(crearProveedorSchema),
  asyncHandler(crearController),
);
proveedoresRouter.patch(
  "/:id",
  gestionar,
  validate(actualizarProveedorSchema),
  asyncHandler(actualizarController),
);
proveedoresRouter.delete("/:id", gestionar, asyncHandler(desactivarController));
