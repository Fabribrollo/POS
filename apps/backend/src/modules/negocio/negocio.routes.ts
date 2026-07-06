import { Router } from "express";
import { authGuard } from "../../core/middlewares/authGuard.js";
import { obtenerController } from "./negocio.controller.js";

export const negocioRouter: Router = Router();

// Solo requiere sesión iniciada, no un permiso específico: son datos de
// visualización (para el ticket impreso), no información sensible del
// negocio ni una operación sobre datos propios.
negocioRouter.use(authGuard);
negocioRouter.get("/", obtenerController);
