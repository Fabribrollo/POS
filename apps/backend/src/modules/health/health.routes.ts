import { Router } from "express";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { prisma } from "../../core/prisma.js";

export const healthRouter: Router = Router();

// Usado por Electron para saber cuándo el backend embebido (con DB ya
// migrada) está listo para que la ventana navegue hacia la UI.
healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  }),
);
