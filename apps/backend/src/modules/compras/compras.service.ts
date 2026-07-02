import type { CrearCompraInput } from "@pos/shared";
import { TIPO_MOVIMIENTO_STOCK } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { buscarProveedor } from "../proveedores/proveedores.service.js";
import { aplicarMovimientoStockTx, resolverDepositoId, validarProductoYVariante } from "../stock/stock.service.js";
import * as comprasRepository from "./compras.repository.js";

export async function crearCompra(input: CrearCompraInput, _usuarioId: number) {
  await buscarProveedor(input.proveedorId);

  for (const item of input.items) {
    await validarProductoYVariante(item.productoId, item.varianteId);
  }

  const total = input.items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);

  return prisma.$transaction(async (tx) => {
    const numero = await comprasRepository.siguienteNumero(tx);
    return comprasRepository.crear(tx, {
      numero,
      proveedorId: input.proveedorId,
      total,
      items: input.items.map((item) => ({
        productoId: item.productoId,
        varianteId: item.varianteId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.cantidad * item.precioUnitario,
      })),
    });
  });
}

export async function buscarCompra(id: number) {
  const compra = await comprasRepository.buscarPorId(prisma, id);
  if (!compra) throw new NotFoundError("Compra no encontrada");
  return compra;
}

export function listarCompras() {
  return comprasRepository.listar();
}

// Recibir mercadería es lo que efectivamente mueve stock: la orden de compra
// por sí sola solo reserva un número y un total, no toca inventario.
export async function recibirCompra(id: number, usuarioId: number) {
  const compra = await buscarCompra(id);
  if (compra.estado !== "PENDIENTE") {
    throw new BusinessRuleError("Solo se puede recibir una compra que está pendiente");
  }

  const depositoId = await resolverDepositoId();

  return prisma.$transaction(async (tx) => {
    for (const item of compra.items) {
      await aplicarMovimientoStockTx(
        tx,
        {
          productoId: item.productoId,
          varianteId: item.varianteId ?? undefined,
          depositoId,
          usuarioId,
        },
        TIPO_MOVIMIENTO_STOCK.COMPRA,
        item.cantidad,
        `Recepción compra ${compra.numero}`,
        { tipo: "COMPRA", id: compra.id },
      );

      // El costo de compra más reciente pasa a ser el costo vigente del
      // producto, tal como se espera en un POS real.
      await comprasRepository.actualizarPrecioCosto(tx, item.productoId, Number(item.precioUnitario));
    }

    return comprasRepository.actualizarEstado(tx, id, "RECIBIDA");
  });
}

export async function anularCompra(id: number) {
  const compra = await buscarCompra(id);
  if (compra.estado !== "PENDIENTE") {
    throw new BusinessRuleError(
      "Solo se puede anular una compra pendiente; una compra ya recibida movió stock real",
    );
  }
  return comprasRepository.actualizarEstado(prisma, id, "ANULADA");
}
