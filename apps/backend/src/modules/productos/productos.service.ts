import type {
  ActualizarProductoInput,
  ActualizarVarianteInput,
  CrearProductoInput,
  CrearVarianteInput,
} from "@pos/shared";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as categoriasRepository from "../categorias/categorias.repository.js";
import * as marcasRepository from "../marcas/marcas.repository.js";
import * as productosRepository from "./productos.repository.js";

async function validarCategoriaYMarca(categoriaId?: number, marcaId?: number): Promise<void> {
  if (categoriaId) {
    const categoria = await categoriasRepository.buscarPorId(categoriaId);
    if (!categoria) throw new BusinessRuleError("La categoría indicada no existe");
  }
  if (marcaId) {
    const marca = await marcasRepository.buscarPorId(marcaId);
    if (!marca) throw new BusinessRuleError("La marca indicada no existe");
  }
}

export function listarProductos() {
  return productosRepository.listar();
}

export async function buscarProducto(id: number) {
  const producto = await productosRepository.buscarPorId(id);
  if (!producto) throw new NotFoundError("Producto no encontrado");
  return producto;
}

export async function buscarProductoPorCodigo(codigo: string) {
  const producto = await productosRepository.buscarPorCodigo(codigo);
  if (!producto) throw new NotFoundError("Producto no encontrado");
  return producto;
}

export async function crearProducto(input: CrearProductoInput) {
  await validarCategoriaYMarca(input.categoriaId, input.marcaId);
  return productosRepository.crear(input);
}

export async function actualizarProducto(id: number, input: ActualizarProductoInput) {
  await buscarProducto(id);
  await validarCategoriaYMarca(input.categoriaId, input.marcaId);
  return productosRepository.actualizar(id, input);
}

// Baja lógica: un producto con ventas o movimientos de stock históricos no
// se borra físicamente, solo se oculta del catálogo activo.
export async function desactivarProducto(id: number) {
  await buscarProducto(id);
  return productosRepository.actualizar(id, { activo: false });
}

export async function crearVariante(productoId: number, input: CrearVarianteInput) {
  await buscarProducto(productoId);
  return productosRepository.crearVariante(productoId, input);
}

export async function listarVariantes(productoId: number) {
  await buscarProducto(productoId);
  return productosRepository.listarVariantes(productoId);
}

async function buscarVariante(id: number) {
  const variante = await productosRepository.buscarVariantePorId(id);
  if (!variante) throw new NotFoundError("Variante no encontrada");
  return variante;
}

export async function actualizarVariante(id: number, input: ActualizarVarianteInput) {
  await buscarVariante(id);
  return productosRepository.actualizarVariante(id, input);
}

export async function desactivarVariante(id: number) {
  await buscarVariante(id);
  return productosRepository.actualizarVariante(id, { activo: false });
}
