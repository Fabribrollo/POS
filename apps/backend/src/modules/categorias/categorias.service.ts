import type { ActualizarCategoriaInput, CrearCategoriaInput } from "@pos/shared";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as categoriasRepository from "./categorias.repository.js";

export function listarCategorias() {
  return categoriasRepository.listar();
}

export async function crearCategoria(input: CrearCategoriaInput) {
  const existente = await categoriasRepository.buscarPorNombre(input.nombre);
  if (existente) {
    throw new BusinessRuleError("Ya existe una categoría con ese nombre");
  }
  return categoriasRepository.crear(input.nombre);
}

export async function actualizarCategoria(id: number, input: ActualizarCategoriaInput) {
  const categoria = await categoriasRepository.buscarPorId(id);
  if (!categoria) {
    throw new NotFoundError("Categoría no encontrada");
  }
  return categoriasRepository.actualizar(id, input);
}

// Baja lógica: una categoría con productos asociados no se borra físicamente.
export async function desactivarCategoria(id: number) {
  const categoria = await categoriasRepository.buscarPorId(id);
  if (!categoria) {
    throw new NotFoundError("Categoría no encontrada");
  }
  return categoriasRepository.actualizar(id, { activo: false });
}
