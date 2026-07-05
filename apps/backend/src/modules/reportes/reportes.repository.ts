import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../core/prisma.js";

export interface RangoFechas {
  desde?: Date;
  hasta?: Date;
}

export interface Paginacion {
  pagina: number;
  porPagina: number;
}

export interface Orden {
  ordenarPor?: string;
  direccion: "asc" | "desc";
}

function rangoFecha(rango: RangoFechas) {
  if (!rango.desde && !rango.hasta) return undefined;
  return { gte: rango.desde, lte: rango.hasta };
}

export function ventasCompletadas(rango: RangoFechas) {
  return prisma.venta.findMany({
    where: { estado: "COMPLETADA", createdAt: rangoFecha(rango) },
    select: { id: true, numero: true, total: true, usuarioId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function ventasPorVendedor(rango: RangoFechas) {
  const agrupado = await prisma.venta.groupBy({
    by: ["usuarioId"],
    where: { estado: "COMPLETADA", createdAt: rangoFecha(rango) },
    _sum: { total: true },
    _count: { _all: true },
  });
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: agrupado.map((g) => g.usuarioId) } },
    select: { id: true, nombre: true },
  });
  return { agrupado, usuarios };
}

export async function productosMasVendidos(rango: RangoFechas, take: number) {
  const agrupado = await prisma.itemVenta.groupBy({
    by: ["productoId"],
    where: { venta: { estado: "COMPLETADA", createdAt: rangoFecha(rango) } },
    _sum: { cantidad: true, subtotal: true },
    orderBy: { _sum: { cantidad: "desc" } },
    take,
  });
  const productos = await prisma.producto.findMany({
    where: { id: { in: agrupado.map((g) => g.productoId) } },
    select: { id: true, nombre: true, codigoInterno: true },
  });
  return { agrupado, productos };
}

export function itemsParaRentabilidad(rango: RangoFechas) {
  return prisma.itemVenta.findMany({
    where: { venta: { estado: "COMPLETADA", createdAt: rangoFecha(rango) } },
    select: { cantidad: true, costoUnitario: true },
  });
}

export function ventasTotalPeriodo(rango: RangoFechas) {
  return prisma.venta.aggregate({
    where: { estado: "COMPLETADA", createdAt: rangoFecha(rango) },
    _sum: { total: true },
  });
}

export function egresosOperativos(rango: RangoFechas) {
  return prisma.movimientoCaja.aggregate({
    where: { tipo: "EGRESO", ventaId: null, createdAt: rangoFecha(rango) },
    _sum: { monto: true },
  });
}

export function stockConProducto() {
  return prisma.stock.findMany({ include: { producto: true } });
}

export async function productosSinMovimientoDesde(cutoff: Date) {
  const movimientos = await prisma.movimientoStock.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { productoId: true },
    distinct: ["productoId"],
  });
  const idsConMovimiento = movimientos.map((m) => m.productoId);
  return prisma.producto.findMany({
    where: { activo: true, id: { notIn: idsConMovimiento } },
  });
}

export function cajaAbiertaAhora() {
  return prisma.caja.findFirst({ where: { estado: "ABIERTA" } });
}

const CAMPOS_ORDEN_VENTAS = new Set(["createdAt", "total", "numero"]);

// Reporte de Ventas: listado paginado/ordenable/buscable (no confundir con
// ventasCompletadas, que trae todo sin paginar y se usa para KPIs/dashboard).
export async function ventasPaginadas(
  rango: RangoFechas,
  paginacion: Paginacion,
  busqueda: string | undefined,
  orden: Orden,
) {
  const campoOrden = orden.ordenarPor && CAMPOS_ORDEN_VENTAS.has(orden.ordenarPor) ? orden.ordenarPor : "createdAt";
  const where: Prisma.VentaWhereInput = {
    estado: "COMPLETADA",
    createdAt: rangoFecha(rango),
    ...(busqueda
      ? {
          OR: [
            { numero: { contains: busqueda } },
            { cliente: { nombre: { contains: busqueda } } },
            { usuario: { nombre: { contains: busqueda } } },
          ],
        }
      : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
        pagos: { include: { medioPago: true } },
      },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.venta.count({ where }),
  ]);

  return { datos, total };
}

const CAMPOS_ORDEN_CAJAS = new Set(["fechaApertura", "montoApertura", "diferencia"]);

// Reporte de Caja: aperturas/cierres paginados, con quién abrió/cerró y el
// resultado del arqueo.
export async function cajasPaginadas(
  rango: RangoFechas,
  paginacion: Paginacion,
  busqueda: string | undefined,
  orden: Orden,
) {
  const campoOrden =
    orden.ordenarPor && CAMPOS_ORDEN_CAJAS.has(orden.ordenarPor) ? orden.ordenarPor : "fechaApertura";
  const where: Prisma.CajaWhereInput = {
    fechaApertura: rangoFecha(rango),
    ...(busqueda
      ? {
          OR: [
            { usuarioApertura: { nombre: { contains: busqueda } } },
            { usuarioCierre: { nombre: { contains: busqueda } } },
          ],
        }
      : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.caja.findMany({
      where,
      include: {
        usuarioApertura: { select: { id: true, nombre: true } },
        usuarioCierre: { select: { id: true, nombre: true } },
        _count: { select: { movimientos: true, ventas: true } },
      },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.caja.count({ where }),
  ]);

  return { datos, total };
}

export function diferenciasCajasPeriodo(rango: RangoFechas) {
  return prisma.caja.aggregate({
    where: { estado: "CERRADA", fechaApertura: rangoFecha(rango) },
    _sum: { diferencia: true },
    _count: { _all: true },
  });
}

// Reporte de Productos y de Ganancias parten de la misma agregación (unidades
// y facturado por producto en el período); cada service la interpreta
// distinto (ranking vs. margen), así que vive una sola vez acá.
export async function productosVendidosPeriodo(rango: RangoFechas, busqueda: string | undefined) {
  const agrupado = await prisma.itemVenta.groupBy({
    by: ["productoId"],
    where: {
      venta: { estado: "COMPLETADA", createdAt: rangoFecha(rango) },
      ...(busqueda ? { producto: { nombre: { contains: busqueda } } } : {}),
    },
    _sum: { cantidad: true, subtotal: true },
  });
  const productos = await prisma.producto.findMany({
    where: { id: { in: agrupado.map((g) => g.productoId) } },
    select: { id: true, nombre: true, codigoInterno: true, precioCosto: true },
  });
  return { agrupado, productos };
}

const CAMPOS_ORDEN_STOCK = new Set(["cantidad"]);

// Inventario: paginado sobre Stock (no sobre Producto), porque el mismo
// producto puede tener varias filas de stock (una por variante/depósito).
export async function stockPaginado(paginacion: Paginacion, busqueda: string | undefined, orden: Orden) {
  const campoOrden = orden.ordenarPor && CAMPOS_ORDEN_STOCK.has(orden.ordenarPor) ? orden.ordenarPor : "cantidad";
  const where: Prisma.StockWhereInput = busqueda ? { producto: { nombre: { contains: busqueda } } } : {};

  const [datos, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      include: { producto: { include: { categoria: true, marca: true } } },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.stock.count({ where }),
  ]);

  return { datos, total };
}

const CAMPOS_ORDEN_CLIENTES = new Set(["nombre", "createdAt"]);

export async function clientesPaginado(paginacion: Paginacion, busqueda: string | undefined, orden: Orden) {
  const campoOrden = orden.ordenarPor && CAMPOS_ORDEN_CLIENTES.has(orden.ordenarPor) ? orden.ordenarPor : "nombre";
  const where: Prisma.ClienteWhereInput = {
    activo: true,
    ...(busqueda
      ? { OR: [{ nombre: { contains: busqueda } }, { documento: { contains: busqueda } }] }
      : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.cliente.count({ where }),
  ]);

  return { datos, total };
}

export function comprasPorCliente(clienteIds: number[], rango: RangoFechas) {
  return prisma.venta.groupBy({
    by: ["clienteId"],
    where: { clienteId: { in: clienteIds }, estado: "COMPLETADA", createdAt: rangoFecha(rango) },
    _sum: { total: true },
    _count: { _all: true },
  });
}

// Saldo actual = el saldoNuevo del último movimiento de cuenta corriente de
// cada cliente (no hay un campo "saldo" propio en Cliente).
export function saldosClientes(clienteIds: number[]) {
  return prisma.movimientoCuentaCorriente.findMany({
    where: { clienteId: { in: clienteIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["clienteId"],
    select: { clienteId: true, saldoNuevo: true },
  });
}

const CAMPOS_ORDEN_USUARIOS = new Set(["nombre"]);

export async function usuariosPaginado(paginacion: Paginacion, busqueda: string | undefined, orden: Orden) {
  const campoOrden = orden.ordenarPor && CAMPOS_ORDEN_USUARIOS.has(orden.ordenarPor) ? orden.ordenarPor : "nombre";
  const where: Prisma.UsuarioWhereInput = {
    activo: true,
    ...(busqueda ? { nombre: { contains: busqueda } } : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: { id: true, nombre: true, rol: { select: { nombre: true } } },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.usuario.count({ where }),
  ]);

  return { datos, total };
}

export function ventasAgregadasPorUsuario(usuarioIds: number[], rango: RangoFechas) {
  return prisma.venta.groupBy({
    by: ["usuarioId"],
    where: { usuarioId: { in: usuarioIds }, estado: "COMPLETADA", createdAt: rangoFecha(rango) },
    _sum: { total: true },
    _count: { _all: true },
  });
}

export function cajasAgregadasPorUsuario(usuarioIds: number[], rango: RangoFechas) {
  return prisma.caja.groupBy({
    by: ["usuarioAperturaId"],
    where: { usuarioAperturaId: { in: usuarioIds }, fechaApertura: rangoFecha(rango) },
    _sum: { diferencia: true },
    _count: { _all: true },
  });
}

// Métodos de pago: siempre son pocos (EFECTIVO, DEBITO, ...), no hace falta
// paginar en la base — se agrupa entero y el service pagina en JS para
// mantener la misma forma de respuesta que el resto de los reportes.
export async function mediosPagoAgregados(rango: RangoFechas) {
  const agrupado = await prisma.pago.groupBy({
    by: ["medioPagoId"],
    where: { venta: { estado: "COMPLETADA", createdAt: rangoFecha(rango) } },
    _sum: { monto: true },
    _count: { _all: true },
  });
  const medios = await prisma.medioPago.findMany({
    where: { id: { in: agrupado.map((g) => g.medioPagoId) } },
  });
  return { agrupado, medios };
}

const CAMPOS_ORDEN_DEVOLUCIONES = new Set(["createdAt", "montoReintegro"]);

export async function devolucionesPaginadas(
  rango: RangoFechas,
  paginacion: Paginacion,
  busqueda: string | undefined,
  orden: Orden,
) {
  const campoOrden =
    orden.ordenarPor && CAMPOS_ORDEN_DEVOLUCIONES.has(orden.ordenarPor) ? orden.ordenarPor : "createdAt";
  const where: Prisma.DevolucionWhereInput = {
    createdAt: rangoFecha(rango),
    ...(busqueda
      ? {
          OR: [
            { cliente: { nombre: { contains: busqueda } } },
            { usuario: { nombre: { contains: busqueda } } },
            { motivo: { contains: busqueda } },
          ],
        }
      : {}),
  };

  const [datos, total] = await Promise.all([
    prisma.devolucion.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
        ventaOriginal: { select: { numero: true } },
      },
      orderBy: { [campoOrden]: orden.direccion },
      skip: (paginacion.pagina - 1) * paginacion.porPagina,
      take: paginacion.porPagina,
    }),
    prisma.devolucion.count({ where }),
  ]);

  return { datos, total };
}

export function devolucionesResumenPeriodo(rango: RangoFechas) {
  return prisma.devolucion.aggregate({
    where: { createdAt: rangoFecha(rango) },
    _sum: { montoReintegro: true },
    _count: { _all: true },
  });
}
