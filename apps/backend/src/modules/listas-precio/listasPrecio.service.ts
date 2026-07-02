import type { AsignarPrecioInput, CrearListaPrecioInput } from "@pos/shared";
import { BusinessRuleError } from "../../core/errors/AppError.js";
import { buscarProducto } from "../productos/productos.service.js";
import * as listasPrecioRepository from "./listasPrecio.repository.js";

export function listarListasPrecio() {
  return listasPrecioRepository.listar();
}

export async function crearListaPrecio(input: CrearListaPrecioInput) {
  const existente = await listasPrecioRepository.buscarPorNombre(input.nombre);
  if (existente) {
    throw new BusinessRuleError("Ya existe una lista de precios con ese nombre");
  }
  return listasPrecioRepository.crear(input.nombre);
}

export async function listarPreciosDeProducto(productoId: number) {
  await buscarProducto(productoId);
  return listasPrecioRepository.listarPreciosDeProducto(productoId);
}

export async function asignarPrecio(input: AsignarPrecioInput) {
  await buscarProducto(input.productoId);
  return listasPrecioRepository.asignarPrecio(
    input.productoId,
    input.listaPrecioId,
    input.precio,
  );
}
