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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      queryValidado?: unknown;
    }
  }
}

// req.query es de solo lectura en los tipos de Express (y sus valores
// siempre arrancan como string), así que en vez de reasignarlo el resultado
// ya validado y coercionado (fechas, números) se guarda aparte en
// `queryValidado` — mismo patrón que `req.usuario` en authGuard.ts.
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.queryValidado = schema.parse(req.query);
    next();
  };
}
