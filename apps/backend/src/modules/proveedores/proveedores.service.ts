import type { ActualizarProveedorInput, CrearProveedorInput } from "@pos/shared";
import { NotFoundError } from "../../core/errors/AppError.js";
import * as proveedoresRepository from "./proveedores.repository.js";

export function listarProveedores() {
  return proveedoresRepository.listar();
}

export async function buscarProveedor(id: number) {
  const proveedor = await proveedoresRepository.buscarPorId(id);
  if (!proveedor) throw new NotFoundError("Proveedor no encontrado");
  return proveedor;
}

export function crearProveedor(input: CrearProveedorInput) {
  return proveedoresRepository.crear(input);
}

export async function actualizarProveedor(id: number, input: ActualizarProveedorInput) {
  await buscarProveedor(id);
  return proveedoresRepository.actualizar(id, input);
}

export async function desactivarProveedor(id: number) {
  await buscarProveedor(id);
  return proveedoresRepository.actualizar(id, { activo: false });
}
