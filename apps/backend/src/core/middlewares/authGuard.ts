import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { type Permiso, type RolNombre, tienePermiso } from "@pos/shared";
import { JWT_SECRET } from "../config.js";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError.js";

export interface SesionUsuario {
  id: number;
  nombre: string;
  rol: RolNombre;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: SesionUsuario;
    }
  }
}

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token no provisto");
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET) as SesionUsuario;
    req.usuario = payload;
    next();
  } catch {
    throw new UnauthorizedError("Token inválido o expirado");
  }
}

// Se compone con authGuard: primero autentica, después autoriza por permiso.
// La tabla de permisos vive en @pos/shared para que backend y frontend
// consulten exactamente la misma regla.
export function roleGuard(permiso: Permiso) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      throw new UnauthorizedError("Sesión no encontrada");
    }
    if (!tienePermiso(req.usuario.rol, permiso)) {
      throw new ForbiddenError(`El rol ${req.usuario.rol} no tiene permiso: ${permiso}`);
    }
    next();
  };
}
