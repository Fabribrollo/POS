import type {
  ActualizarProductoInput,
  ActualizarVarianteInput,
  CrearProductoInput,
  CrearVarianteInput,
  ListarProductosQuery,
} from "@pos/shared";
import { ACCION_AUDITORIA, ENTIDAD_AUDITORIA, TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { registrar } from "../auditoria/auditoria.service.js";
import * as categoriasRepository from "../categorias/categorias.repository.js";
import * as marcasRepository from "../marcas/marcas.repository.js";
import { aplicarMovimientoStockTx, registrarAjuste, resolverDepositoId } from "../stock/stock.service.js";
import { nombreVariante } from "./productos.codigos.js";
import { importarProductosExcel } from "./productos.import.js";
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

export function listarProductos(estado: ListarProductosQuery["estado"]) {
  return productosRepository.listar(estado);
}

export async function buscarProducto(id: number) {
  const producto = await productosRepository.buscarPorId(id);
  if (!producto) throw new NotFoundError("Producto no encontrado");
  return producto;
}

// El escaneo en el punto de venta siempre debe terminar en una variante
// concreta (es lo único que tiene stock propio). Por eso primero busca por
// código de variante; si lo que se escaneó fue el código del producto, no se
// agrega directo: se devuelve el producto para que el POS muestre un
// selector, salvo que tenga una sola variante (ahí no hay nada que elegir).
export async function escanearCodigo(codigo: string) {
  const variante = await productosRepository.buscarVariantePorCodigo(codigo);
  if (variante) {
    const producto = await buscarProducto(variante.productoId);
    return { tipo: "variante" as const, producto, variante };
  }

  const producto = await productosRepository.buscarPorCodigo(codigo);
  if (!producto) throw new NotFoundError("Producto no encontrado");

  if (producto.variantes.length === 0) {
    return { tipo: "producto" as const, producto };
  }
  if (producto.variantes.length === 1) {
    return { tipo: "variante" as const, producto, variante: producto.variantes[0] };
  }
  return { tipo: "elegir_variante" as const, producto };
}

export async function crearProducto(input: CrearProductoInput, usuarioId: number) {
  await validarCategoriaYMarca(input.categoriaId, input.marcaId);
  const producto = await productosRepository.crear(input);
  await registrar(prisma, {
    usuarioId,
    accion: ACCION_AUDITORIA.CREAR,
    entidad: ENTIDAD_AUDITORIA.PRODUCTO,
    entidadId: producto.id,
    detalle: { nombre: producto.nombre, precioVenta: input.precioVenta, precioCosto: input.precioCosto },
  });
  return producto;
}

export function importarProductos(archivoBase64: string, usuarioId: number) {
  return importarProductosExcel(archivoBase64, usuarioId);
}

export async function actualizarProducto(id: number, input: ActualizarProductoInput, usuarioId: number) {
  const anterior = await buscarProducto(id);
  await validarCategoriaYMarca(input.categoriaId, input.marcaId);
  const actualizado = await productosRepository.actualizar(id, input);

  // Solo interesa dejar constancia de los campos sensibles (precio), no de
  // cualquier campo (nombre, descripción) — eso sería ruido para el admin.
  const cambios: Record<string, unknown> = {};
  if (input.precioVenta !== undefined && input.precioVenta !== Number(anterior.precioVenta)) {
    cambios.precioVenta = { antes: Number(anterior.precioVenta), despues: input.precioVenta };
  }
  if (input.precioCosto !== undefined && input.precioCosto !== Number(anterior.precioCosto)) {
    cambios.precioCosto = { antes: Number(anterior.precioCosto), despues: input.precioCosto };
  }
  if (Object.keys(cambios).length > 0) {
    await registrar(prisma, {
      usuarioId,
      accion: ACCION_AUDITORIA.ACTUALIZAR,
      entidad: ENTIDAD_AUDITORIA.PRODUCTO,
      entidadId: id,
      detalle: cambios,
    });
  }

  return actualizado;
}

// Baja lógica: un producto con ventas o movimientos de stock históricos no
// se borra físicamente, solo se oculta del catálogo activo.
export async function desactivarProducto(id: number, usuarioId: number) {
  const anterior = await buscarProducto(id);
  const producto = await productosRepository.actualizar(id, { activo: false });
  await registrar(prisma, {
    usuarioId,
    accion: ACCION_AUDITORIA.DESACTIVAR,
    entidad: ENTIDAD_AUDITORIA.PRODUCTO,
    entidadId: id,
    detalle: { nombre: anterior.nombre },
  });
  return producto;
}

export async function reactivarProducto(id: number, usuarioId: number) {
  const anterior = await buscarProducto(id);
  const producto = await productosRepository.actualizar(id, { activo: true });
  await registrar(prisma, {
    usuarioId,
    accion: ACCION_AUDITORIA.REACTIVAR,
    entidad: ENTIDAD_AUDITORIA.PRODUCTO,
    entidadId: id,
    detalle: { nombre: anterior.nombre },
  });
  return producto;
}

// El usuario solo carga color, talle y stock inicial: nombre, sku, código de
// barras se generan solos (ver productos.codigos.ts) y el stock se registra
// como un movimiento auditable, igual que hace la importación por Excel.
export async function crearVariante(
  productoId: number,
  input: CrearVarianteInput,
  usuarioId: number,
) {
  const producto = await buscarProducto(productoId);
  const depositoId = await resolverDepositoId();

  return prisma.$transaction(async (tx) => {
    const variante = await productosRepository.crearVarianteConCodigos(
      tx,
      productoId,
      producto.codigoInterno,
      {
        nombre: nombreVariante(input.color, input.talle),
        color: input.color,
        talle: input.talle,
      },
    );

    await aplicarMovimientoStockTx(
      tx,
      { productoId, varianteId: variante.id, depositoId, usuarioId },
      TIPO_MOVIMIENTO_STOCK.INGRESO,
      input.stock,
      "Alta manual de variante",
    );

    return variante;
  });
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

// El precio de una variante siempre es el del producto (no hay override), así
// que acá solo se editan color/talle (que recalculan el nombre derivado),
// activo, y el stock (que se ajusta como movimiento, no como campo directo).
export async function actualizarVariante(
  id: number,
  input: ActualizarVarianteInput,
  usuarioId: number,
) {
  const variante = await buscarVariante(id);
  const { stock, ...camposEditables } = input;

  let actualizada = variante;
  if (Object.keys(camposEditables).length > 0) {
    const color = camposEditables.color ?? variante.color ?? undefined;
    const talle = camposEditables.talle ?? variante.talle ?? undefined;
    actualizada = await productosRepository.actualizarVariante(id, {
      ...camposEditables,
      nombre: nombreVariante(color, talle),
    });
  }

  if (stock !== undefined) {
    await registrarAjuste(
      {
        productoId: variante.productoId,
        varianteId: id,
        cantidadNueva: stock,
        motivo: "Ajuste manual desde ficha de producto",
      },
      usuarioId,
    );
  }

  return actualizada;
}

export async function desactivarVariante(id: number) {
  await buscarVariante(id);
  return productosRepository.actualizarVariante(id, { activo: false });
}
