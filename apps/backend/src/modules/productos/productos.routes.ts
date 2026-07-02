import { Router } from "express";
import {
  actualizarProductoSchema,
  actualizarVarianteSchema,
  crearProductoSchema,
  crearVarianteSchema,
} from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  actualizarVarianteController,
  buscarPorCodigoController,
  buscarPorIdController,
  crearController,
  crearVarianteController,
  desactivarController,
  desactivarVarianteController,
  listarController,
  listarVariantesController,
} from "./productos.controller.js";

export const productosRouter: Router = Router();

productosRouter.use(authGuard);

const leer = roleGuard("PRODUCTOS_LEER");
const escribir = roleGuard("PRODUCTOS_ESCRIBIR");

productosRouter.get("/", leer, asyncHandler(listarController));
productosRouter.get("/buscar/:codigo", leer, asyncHandler(buscarPorCodigoController));
productosRouter.get("/:id", leer, asyncHandler(buscarPorIdController));
productosRouter.post("/", escribir, validate(crearProductoSchema), asyncHandler(crearController));
productosRouter.patch(
  "/:id",
  escribir,
  validate(actualizarProductoSchema),
  asyncHandler(actualizarController),
);
productosRouter.delete("/:id", escribir, asyncHandler(desactivarController));

productosRouter.get("/:id/variantes", leer, asyncHandler(listarVariantesController));
productosRouter.post(
  "/:id/variantes",
  escribir,
  validate(crearVarianteSchema),
  asyncHandler(crearVarianteController),
);
productosRouter.patch(
  "/variantes/:varianteId",
  escribir,
  validate(actualizarVarianteSchema),
  asyncHandler(actualizarVarianteController),
);
productosRouter.delete(
  "/variantes/:varianteId",
  escribir,
  asyncHandler(desactivarVarianteController),
);
