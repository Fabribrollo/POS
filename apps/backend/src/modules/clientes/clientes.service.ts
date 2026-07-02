import type {
  ActualizarClienteInput,
  CrearClienteInput,
  MovimientoCuentaCorrienteInput,
} from "@pos/shared";
import { BusinessRuleError, NotFoundError } from "../../core/errors/AppError.js";
import * as clientesRepository from "./clientes.repository.js";

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
  const ultimo = await clientesRepository.ultimoMovimientoCC(clienteId);
  return { saldo: ultimo ? Number(ultimo.saldoNuevo) : 0 };
}

export async function listarMovimientosCC(clienteId: number) {
  await buscarCliente(clienteId);
  return clientesRepository.listarMovimientosCC(clienteId);
}

// DEBITO: el cliente compra a cuenta y su deuda aumenta.
// CREDITO: el cliente paga (total o parcial) y su deuda disminuye.
export async function registrarMovimientoCC(
  clienteId: number,
  input: MovimientoCuentaCorrienteInput,
) {
  const cliente = await buscarCliente(clienteId);
  const ultimo = await clientesRepository.ultimoMovimientoCC(clienteId);
  const saldoAnterior = ultimo ? Number(ultimo.saldoNuevo) : 0;
  const saldoNuevo = input.tipo === "DEBITO" ? saldoAnterior + input.monto : saldoAnterior - input.monto;

  if (
    input.tipo === "DEBITO" &&
    cliente.limiteCuentaCorriente != null &&
    saldoNuevo > Number(cliente.limiteCuentaCorriente)
  ) {
    throw new BusinessRuleError(
      `La operación supera el límite de cuenta corriente del cliente (${cliente.limiteCuentaCorriente})`,
    );
  }

  return clientesRepository.crearMovimientoCC({
    clienteId,
    tipo: input.tipo,
    monto: input.monto,
    saldoAnterior,
    saldoNuevo,
  });
}
