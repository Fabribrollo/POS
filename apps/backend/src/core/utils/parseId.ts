import { ValidationError } from "../errors/AppError.js";

export function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Id inválido");
  }
  return id;
}
