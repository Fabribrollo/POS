import type { ActualizarMarcaInput, CrearMarcaInput } from "@pos/shared";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as marcasRepository from "./marcas.repository.js";

export function listarMarcas() {
  return marcasRepository.listar();
}

export async function crearMarca(input: CrearMarcaInput) {
  const existente = await marcasRepository.buscarPorNombre(input.nombre);
  if (existente) {
    throw new BusinessRuleError("Ya existe una marca con ese nombre");
  }
  return marcasRepository.crear(input.nombre);
}

export async function actualizarMarca(id: number, input: ActualizarMarcaInput) {
  const marca = await marcasRepository.buscarPorId(id);
  if (!marca) {
    throw new NotFoundError("Marca no encontrada");
  }
  return marcasRepository.actualizar(id, input);
}

export async function desactivarMarca(id: number) {
  const marca = await marcasRepository.buscarPorId(id);
  if (!marca) {
    throw new NotFoundError("Marca no encontrada");
  }
  return marcasRepository.actualizar(id, { activo: false });
}
