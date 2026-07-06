import type {
  ActualizarClienteInput,
  CrearClienteInput,
  MovimientoCuentaCorrienteInput,
} from "@pos/shared";
import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as clientesRepository from "./clientes.repository.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function listarClientes() {
  return clientesRepository.listar();
}

export async function buscarCliente(id: number) {
  const cliente = await clientesRepository.buscarPorId(id);
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  return cliente;
}

export async function crearCliente(input: CrearClienteInput) {
  if (input.documento) {
    const existente = await clientesRepository.buscarPorDocumento(input.documento);
    if (existente) {
      throw new BusinessRuleError("Ya existe un cliente con ese documento");
    }
  }
  return clientesRepository.crear(input);
}

export async function actualizarCliente(id: number, input: ActualizarClienteInput) {
  await buscarCliente(id);
  return clientesRepository.actualizar(id, input);
}

export async function desactivarCliente(id: number) {
  await buscarCliente(id);
  return clientesRepository.actualizar(id, { activo: false });
}

export async function historialCompras(clienteId: number) {
  await buscarCliente(clienteId);
  return clientesRepository.historialCompras(clienteId);
}

export async function obtenerSaldoCC(clienteId: number) {
  await buscarCliente(clienteId);
  return { saldo: await saldoCCTx(prisma, clienteId) };
}

export async function listarMovimientosCC(clienteId: number) {
  await buscarCliente(clienteId);
  return clientesRepository.listarMovimientosCC(clienteId);
}

// Saldo positivo = el cliente debe dinero (cuenta corriente clásica).
// Saldo negativo = el cliente tiene crédito a favor (p.ej. por una devolución).
export async function saldoCCTx(db: Db, clienteId: number): Promise<number> {
  const ultimo = await clientesRepository.ultimoMovimientoCC(db, clienteId);
  return ultimo ? Number(ultimo.saldoNuevo) : 0;
}

// DEBITO: el cliente compra a cuenta (o gasta su saldo a favor) y su deuda
// aumenta (o su crédito disminuye). CREDITO: se le acredita saldo (paga una
// deuda, o se le emite una nota de crédito) y su deuda disminuye.
export async function registrarMovimientoCCTx(
  db: Db,
  clienteId: number,
  tipo: "DEBITO" | "CREDITO",
  monto: number,
  ventaId?: number,
) {
  const saldoAnterior = await saldoCCTx(db, clienteId);
  const saldoNuevo = tipo === "DEBITO" ? saldoAnterior + monto : saldoAnterior - monto;
  return clientesRepository.crearMovimientoCC(db, {
    clienteId,
    tipo,
    monto,
    saldoAnterior,
    saldoNuevo,
    ventaId,
  });
}

export async function registrarMovimientoCC(
  clienteId: number,
  input: MovimientoCuentaCorrienteInput,
) {
  const cliente = await buscarCliente(clienteId);
  const saldoAnterior = await saldoCCTx(prisma, clienteId);
  const saldoNuevo =
    input.tipo === "DEBITO" ? saldoAnterior + input.monto : saldoAnterior - input.monto;

  if (
    input.tipo === "DEBITO" &&
    cliente.limiteCuentaCorriente != null &&
    saldoNuevo > Number(cliente.limiteCuentaCorriente)
  ) {
    throw new BusinessRuleError(
      `La operación supera el límite de cuenta corriente del cliente (${cliente.limiteCuentaCorriente})`,
    );
  }

  return clientesRepository.crearMovimientoCC(prisma, {
    clienteId,
    tipo: input.tipo,
    monto: input.monto,
    saldoAnterior,
    saldoNuevo,
  });
}
