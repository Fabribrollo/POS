import { Prisma } from "../../../generated/prisma/index.js";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../errors/AppError.js";

// Middleware de error único (4 argumentos: Express lo reconoce como error
// handler solo si tiene esta firma exacta). Cualquier error lanzado en un
// controller/service llega acá vía `next(err)` o por ser async y estar
// envuelto en el wrapper `asyncHandler`.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const validation = new ValidationError("Datos inválidos", err.flatten());
    res.status(validation.statusCode).json({
      error: { code: validation.code, message: validation.message, details: validation.details },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Red de seguridad: si un service se olvidó de pre-validar duplicados o
  // existencia, esto evita un 500 crudo ante restricciones de la DB.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: { code: "DUPLICATE", message: "Ya existe un registro con ese valor único" },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Registro no encontrado" },
      });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({
        error: { code: "REFERENCIA_INVALIDA", message: "Hace referencia a un registro que no existe" },
      });
      return;
    }
  }

  console.error("Error no controlado:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
}
