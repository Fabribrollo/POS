import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

// El controller nunca ve req.body crudo: llega ya tipado y validado, o el
// request corta acá con un ZodError que errorHandler traduce a 400.
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
