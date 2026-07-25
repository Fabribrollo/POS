import { Router } from "express";
import { auditoriaQuerySchema } from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validateQuery } from "../../core/middlewares/validate.js";
import {
  exportarExcelController,
  exportarPdfController,
  listarController,
} from "./auditoria.controller.js";

export const auditoriaRouter: Router = Router();

// Permiso exclusivo de ADMINISTRADOR (ver roles.ts): el registro puede
// incluir acciones del propio Encargado, así que no comparte el guard más
// laxo de REPORTES_VER.
auditoriaRouter.use(authGuard, roleGuard("AUDITORIA_VER"));

auditoriaRouter.get("/", validateQuery(auditoriaQuerySchema), asyncHandler(listarController));
auditoriaRouter.get(
  "/exportar.xlsx",
  validateQuery(auditoriaQuerySchema),
  asyncHandler(exportarExcelController),
);
auditoriaRouter.get(
  "/exportar.pdf",
  validateQuery(auditoriaQuerySchema),
  asyncHandler(exportarPdfController),
);
