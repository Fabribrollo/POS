import { Router } from "express";
import { actualizarUsuarioSchema, crearUsuarioSchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  crearController,
  desactivarController,
  listarController,
} from "./usuarios.controller.js";

export const usuariosRouter: Router = Router();

// Toda la gestión de usuarios es exclusiva del administrador (ver matriz de
// permisos en @pos/shared/constants/roles.ts).
usuariosRouter.use(authGuard, roleGuard("USUARIOS_ADMINISTRAR"));

usuariosRouter.get("/", asyncHandler(listarController));
usuariosRouter.post("/", validate(crearUsuarioSchema), asyncHandler(crearController));
usuariosRouter.patch("/:id", validate(actualizarUsuarioSchema), asyncHandler(actualizarController));
usuariosRouter.delete("/:id", asyncHandler(desactivarController));
