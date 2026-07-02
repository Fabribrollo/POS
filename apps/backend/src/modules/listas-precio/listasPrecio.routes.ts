import { Router } from "express";
import { asignarPrecioSchema, crearListaPrecioSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  asignarPrecioController,
  crearController,
  listarController,
  listarPreciosDeProductoController,
} from "./listasPrecio.controller.js";

export const listasPrecioRouter: Router = Router();

listasPrecioRouter.use(authGuard);

const leer = roleGuard("PRODUCTOS_LEER");
const escribir = roleGuard("PRODUCTOS_ESCRIBIR");

listasPrecioRouter.get("/", leer, asyncHandler(listarController));
listasPrecioRouter.post(
  "/",
  escribir,
  validate(crearListaPrecioSchema),
  asyncHandler(crearController),
);
listasPrecioRouter.get(
  "/producto/:productoId",
  leer,
  asyncHandler(listarPreciosDeProductoController),
);
listasPrecioRouter.post(
  "/asignar",
  escribir,
  validate(asignarPrecioSchema),
  asyncHandler(asignarPrecioController),
);
