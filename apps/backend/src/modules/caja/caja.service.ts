import { Prisma } from "../../../generated/prisma/index.js";
import type { AbrirCajaInput, CerrarCajaInput, MovimientoCajaInput } from "@pos/shared";
import { ACCION_AUDITORIA, ENTIDAD_AUDITORIA, TIPO_MOVIMIENTO_CAJA } from "@pos/shared";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import { registrar } from "../auditoria/auditoria.service.js";
import * as cajaRepository from "./caja.repository.js";

// montoApertura/monto vienen de la DB como Prisma.Decimal, no como number:
// sumarlos con "+" sin convertir concatenaría strings en vez de sumar.
function calcularMontoSistema(
  montoApertura: Prisma.Decimal | number,
  movimientos: { tipo: string; monto: Prisma.Decimal | number }[],
): number {
  return movimientos.reduce((total, mov) => {
    const suma = [TIPO_MOVIMIENTO_CAJA.INGRESO, TIPO_MOVIMIENTO_CAJA.VENTA].includes(
      mov.tipo as never,
    );
    const monto = Number(mov.monto);
    return suma ? total + monto : total - monto;
  }, Number(montoApertura));
}

const MENSAJE_CAJA_YA_ABIERTA = "Ya hay una caja abierta. Debe cerrarla antes de abrir otra.";

export async function abrirCaja(usuarioId: number, input: AbrirCajaInput) {
  // Chequeo previo: cubre el caso normal con un mensaje claro de una. No es
  // garantía ante una carrera real (dos aperturas casi simultáneas podrían
  // pasar las dos este chequeo) — la garantía de verdad es el índice único
  // de estadoAbierta en la base, que se traduce más abajo.
  const abierta = await cajaRepository.buscarAbierta();
  if (abierta) {
    throw new BusinessRuleError(MENSAJE_CAJA_YA_ABIERTA);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const caja = await cajaRepository.crear(tx, usuarioId, input.montoApertura);
      await registrar(tx, {
        usuarioId,
        accion: ACCION_AUDITORIA.ABRIR,
        entidad: ENTIDAD_AUDITORIA.CAJA,
        entidadId: caja.id,
        detalle: { montoApertura: input.montoApertura },
      });
      return caja;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BusinessRuleError(MENSAJE_CAJA_YA_ABIERTA);
    }
    throw err;
  }
}

export async function obtenerCajaAbierta() {
  const caja = await cajaRepository.buscarAbierta();
  if (!caja) {
    throw new NotFoundError("No hay ninguna caja abierta");
  }
  return caja;
}

export async function registrarMovimientoManual(input: MovimientoCajaInput, usuarioId: number) {
  const caja = await obtenerCajaAbierta();
  return cajaRepository.crearMovimiento(prisma, {
    cajaId: caja.id,
    tipo: input.tipo,
    monto: input.monto,
    concepto: input.concepto,
    usuarioId,
  });
}

// Núcleo reutilizable dentro de una transacción ajena: ventas y devoluciones
// mueven la caja física en el mismo commit en el que descuentan/reponen
// stock y registran el pago, para que nunca queden desincronizados.
export function registrarMovimientoTx(
  tx: Prisma.TransactionClient,
  data: { cajaId: number; tipo: string; monto: number; concepto: string; usuarioId: number; ventaId?: number },
) {
  return cajaRepository.crearMovimiento(tx, data);
}

export function registrarMovimientoVenta(
  tx: Prisma.TransactionClient,
  cajaId: number,
  monto: number,
  ventaId: number,
  usuarioId: number,
) {
  return registrarMovimientoTx(tx, {
    cajaId,
    tipo: TIPO_MOVIMIENTO_CAJA.VENTA,
    monto,
    concepto: `Venta #${ventaId}`,
    usuarioId,
    ventaId,
  });
}

// Reversa el efectivo de una venta anulada. Nunca se permite sobre una caja
// ya cerrada (ver ventas.service.anularVenta): reabrir el arqueo de un turno
// ya conciliado corrompería la contabilidad de ese cierre.
export function revertirMovimientoVenta(
  tx: Prisma.TransactionClient,
  cajaId: number,
  monto: number,
  ventaId: number,
  usuarioId: number,
) {
  return registrarMovimientoTx(tx, {
    cajaId,
    tipo: TIPO_MOVIMIENTO_CAJA.EGRESO,
    monto,
    concepto: `Anulación venta #${ventaId}`,
    usuarioId,
    ventaId,
  });
}

export async function cerrarCaja(usuarioId: number, input: CerrarCajaInput) {
  const caja = await obtenerCajaAbierta();
  const movimientos = await cajaRepository.sumarMovimientos(prisma, caja.id);
  const montoCierreSistema = calcularMontoSistema(caja.montoApertura, movimientos);
  const diferencia = input.montoCierreDeclarado - montoCierreSistema;

  return prisma.$transaction(async (tx) => {
    const cerrada = await cajaRepository.cerrar(tx, caja.id, {
      usuarioCierreId: usuarioId,
      montoCierreDeclarado: input.montoCierreDeclarado,
      montoCierreSistema,
      diferencia,
      observaciones: input.observaciones,
    });

    await registrar(tx, {
      usuarioId,
      accion: ACCION_AUDITORIA.CERRAR,
      entidad: ENTIDAD_AUDITORIA.CAJA,
      entidadId: caja.id,
      detalle: { montoCierreDeclarado: input.montoCierreDeclarado, montoCierreSistema, diferencia },
    });

    return cerrada;
  });
}

export async function listarMovimientos(cajaId: number) {
  const caja = await cajaRepository.buscarPorId(cajaId);
  if (!caja) throw new NotFoundError("Caja no encontrada");
  return cajaRepository.listarMovimientos(cajaId);
}

export function listarHistorial() {
  return cajaRepository.listarHistorial();
}
