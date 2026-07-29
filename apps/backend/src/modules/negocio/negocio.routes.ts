import { Router } from "express";
import { authGuard } from "../../core/middlewares/authGuard.js";
import { logoController, obtenerController } from "./negocio.controller.js";

export const negocioRouter: Router = Router();

// El logo es un asset de imagen sin datos sensibles: se sirve sin sesión
// para poder usarse en un <img> directo (que no puede mandar el header
// Authorization) y, a futuro, en la pantalla de login antes de autenticarse.
negocioRouter.get("/logo", logoController);

// El resto solo requiere sesión iniciada, no un permiso específico: son
// datos de visualización (para el ticket impreso), no información sensible
// del negocio ni una operación sobre datos propios.
negocioRouter.use(authGuard);
negocioRouter.get("/", obtenerController);
