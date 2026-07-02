import * as reportesRepository from "./reportes.repository.js";
import type { RangoFechas } from "./reportes.repository.js";

export async function ventasPorPeriodo(rango: RangoFechas) {
  const ventas = await reportesRepository.ventasCompletadas(rango);
  const totalVentas = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  return {
    cantidadVentas: ventas.length,
    totalVentas,
    promedioVenta: ventas.length ? totalVentas / ventas.length : 0,
    ventas,
  };
}

export async function ventasPorVendedor(rango: RangoFechas) {
  const { agrupado, usuarios } = await reportesRepository.ventasPorVendedor(rango);
  return agrupado
    .map((g) => ({
      usuarioId: g.usuarioId,
      nombre: usuarios.find((u) => u.id === g.usuarioId)?.nombre ?? "Desconocido",
      cantidadVentas: g._count._all,
      totalVentas: Number(g._sum.total ?? 0),
    }))
    .sort((a, b) => b.totalVentas - a.totalVentas);
}

export async function productosMasVendidos(rango: RangoFechas, take = 10) {
  const { agrupado, productos } = await reportesRepository.productosMasVendidos(rango, take);
  return agrupado.map((g) => {
    const producto = productos.find((p) => p.id === g.productoId);
    return {
      productoId: g.productoId,
      nombre: producto?.nombre ?? "Producto eliminado",
      codigoInterno: producto?.codigoInterno,
      cantidadVendida: g._sum.cantidad ?? 0,
      totalVendido: Number(g._sum.subtotal ?? 0),
    };
  });
}

// Ganancia bruta = ventas del período (ya netas de descuentos) menos el costo
// de mercadería vendida al costoUnitario vigente EN EL MOMENTO de cada venta.
// Ganancia neta descuenta además los egresos de caja operativos (no ligados
// a una venta): alquiler, insumos, etc. Los egresos que revierten una venta
// (devoluciones/anulaciones) están ligados a un ventaId y quedan excluidos
// para no contar dos veces el mismo movimiento.
export async function rentabilidad(rango: RangoFechas) {
  const [items, ventasTotal, egresos] = await Promise.all([
    reportesRepository.itemsParaRentabilidad(rango),
    reportesRepository.ventasTotalPeriodo(rango),
    reportesRepository.egresosOperativos(rango),
  ]);

  const costoMercaderiaVendida = items.reduce(
    (acc, item) => acc + item.cantidad * Number(item.costoUnitario),
    0,
  );
  const totalVentas = Number(ventasTotal._sum.total ?? 0);
  const gananciaBruta = totalVentas - costoMercaderiaVendida;
  const gastosOperativos = Number(egresos._sum.monto ?? 0);
  const gananciaNeta = gananciaBruta - gastosOperativos;

  return { totalVentas, costoMercaderiaVendida, gananciaBruta, gastosOperativos, gananciaNeta };
}

export async function stockValorizado() {
  const stock = await reportesRepository.stockConProducto();
  const detalle = stock.map((s) => ({
    productoId: s.productoId,
    producto: s.producto.nombre,
    cantidad: s.cantidad,
    valorCosto: s.cantidad * Number(s.producto.precioCosto),
    valorVenta: s.cantidad * Number(s.producto.precioVenta),
  }));
  return {
    totalValorCosto: detalle.reduce((acc, d) => acc + d.valorCosto, 0),
    totalValorVenta: detalle.reduce((acc, d) => acc + d.valorVenta, 0),
    detalle,
  };
}

export function productosSinMovimiento(dias: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dias);
  return reportesRepository.productosSinMovimientoDesde(cutoff);
}
