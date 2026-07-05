import type { PaginacionQuery, RangoFechasQuery, ReporteQuery } from "@pos/shared";
import * as reportesRepository from "./reportes.repository.js";
import type { RangoFechas } from "./reportes.repository.js";

interface QueryPaginable {
  pagina: number;
  porPagina: number;
  ordenarPor?: string;
  direccion: "asc" | "desc";
}

// Varios reportes (Productos, Ganancias, Métodos de Pago) parten de un
// groupBy que Prisma no puede paginar/ordenar de forma consistente junto con
// el join a otra tabla (producto/medioPago), así que se arma el array
// completo y se ordena/pagina acá — mismo criterio que ya usa dashboard()
// para bucketear ventas por día en JS en vez de SQL.
function paginarYOrdenar<T>(
  filas: T[],
  query: QueryPaginable,
  extractores: Record<string, (f: T) => string | number>,
) {
  const claveDefault = Object.keys(extractores)[0];
  const extraer = (query.ordenarPor && extractores[query.ordenarPor]) || extractores[claveDefault];
  const ordenadas = [...filas].sort((a, b) => {
    const va = extraer(a);
    const vb = extraer(b);
    const cmp =
      typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return query.direccion === "asc" ? cmp : -cmp;
  });
  const total = ordenadas.length;
  const inicio = (query.pagina - 1) * query.porPagina;
  return {
    datos: ordenadas.slice(inicio, inicio + query.porPagina),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
  };
}

const DIAS_RANGO_DEFAULT = 30;

// Si no se manda ningún filtro de fecha, se reporta sobre los últimos 30
// días en vez de fallar o traer todo el histórico sin querer.
function resolverRango(rango: RangoFechas): { desde: Date; hasta: Date } {
  if (!rango.desde && !rango.hasta) {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_RANGO_DEFAULT);
    return { desde, hasta };
  }
  return { desde: rango.desde ?? new Date(0), hasta: rango.hasta ?? new Date() };
}

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

export async function reporteVentas(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const { datos, total } = await reportesRepository.ventasPaginadas(
    rango,
    { pagina: query.pagina, porPagina: query.porPagina },
    query.busqueda,
    { ordenarPor: query.ordenarPor, direccion: query.direccion },
  );

  return {
    datos: datos.map((v) => ({
      id: v.id,
      numero: v.numero,
      fecha: v.createdAt,
      cliente: v.cliente?.nombre ?? "Consumidor final",
      vendedor: v.usuario.nombre,
      mediosPago: v.pagos.map((p) => p.medioPago.nombre).join(", ") || "-",
      total: Number(v.total),
    })),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
  };
}

export async function reporteCaja(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const [{ datos, total }, diferencias] = await Promise.all([
    reportesRepository.cajasPaginadas(
      rango,
      { pagina: query.pagina, porPagina: query.porPagina },
      query.busqueda,
      { ordenarPor: query.ordenarPor, direccion: query.direccion },
    ),
    reportesRepository.diferenciasCajasPeriodo(rango),
  ]);

  return {
    datos: datos.map((c) => ({
      id: c.id,
      fechaApertura: c.fechaApertura,
      fechaCierre: c.fechaCierre,
      usuarioApertura: c.usuarioApertura.nombre,
      usuarioCierre: c.usuarioCierre?.nombre ?? null,
      montoApertura: Number(c.montoApertura),
      montoCierreDeclarado: c.montoCierreDeclarado != null ? Number(c.montoCierreDeclarado) : null,
      montoCierreSistema: c.montoCierreSistema != null ? Number(c.montoCierreSistema) : null,
      diferencia: c.diferencia != null ? Number(c.diferencia) : null,
      estado: c.estado,
      cantidadVentas: c._count.ventas,
      cantidadMovimientos: c._count.movimientos,
    })),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    resumen: {
      diferenciaTotal: Number(diferencias._sum.diferencia ?? 0),
      cantidadCajas: diferencias._count._all,
    },
  };
}

// Resumen ejecutivo: reutiliza ventasPorPeriodo/rentabilidad/productosMasVendidos
// (no duplica esa lógica) y le suma la serie diaria para el gráfico y la
// comparación contra el período anterior de igual duración.
export async function dashboard(rangoInput: RangoFechasQuery) {
  const rango = resolverRango(rangoInput);
  const duracionMs = rango.hasta.getTime() - rango.desde.getTime();
  const rangoAnterior = {
    desde: new Date(rango.desde.getTime() - duracionMs),
    hasta: new Date(rango.desde.getTime() - 1),
  };

  const [actual, anteriorTotal, rentabilidadActual, topProductos, cajaAbierta] = await Promise.all([
    ventasPorPeriodo(rango),
    reportesRepository.ventasTotalPeriodo(rangoAnterior),
    rentabilidad(rango),
    productosMasVendidos(rango, 5),
    reportesRepository.cajaAbiertaAhora(),
  ]);

  const totalAnterior = Number(anteriorTotal._sum.total ?? 0);
  // Sin ventas en el período anterior no hay base para calcular una
  // variación porcentual con sentido (evita dividir por cero / Infinity).
  const variacionPorcentual =
    totalAnterior > 0 ? ((actual.totalVentas - totalAnterior) / totalAnterior) * 100 : null;

  const ventasPorDia = new Map<string, number>();
  for (const v of actual.ventas) {
    const clave = v.createdAt.toISOString().slice(0, 10);
    ventasPorDia.set(clave, (ventasPorDia.get(clave) ?? 0) + Number(v.total));
  }

  return {
    rango: { desde: rango.desde, hasta: rango.hasta },
    kpis: {
      totalVentas: actual.totalVentas,
      cantidadVentas: actual.cantidadVentas,
      ticketPromedio: actual.promedioVenta,
      gananciaNeta: rentabilidadActual.gananciaNeta,
      variacionPorcentual,
      cajaAbierta: cajaAbierta != null,
    },
    ventasPorDia: [...ventasPorDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, total]) => ({ fecha, total })),
    topProductos,
  };
}

// Ranking de productos vendidos en el período: unidades y facturado. Para
// margen/rentabilidad por producto ver reporteGanancias.
export async function reporteProductos(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const { agrupado, productos } = await reportesRepository.productosVendidosPeriodo(rango, query.busqueda);

  const filas = agrupado.map((g) => {
    const producto = productos.find((p) => p.id === g.productoId);
    return {
      productoId: g.productoId,
      nombre: producto?.nombre ?? "Producto eliminado",
      codigoInterno: producto?.codigoInterno ?? "-",
      cantidadVendida: g._sum.cantidad ?? 0,
      totalVendido: Number(g._sum.subtotal ?? 0),
    };
  });

  return paginarYOrdenar(filas, query, {
    cantidadVendida: (f) => f.cantidadVendida,
    totalVendido: (f) => f.totalVendido,
    nombre: (f) => f.nombre,
  });
}

// Stock actual valorizado, paginado. El resumen (totales de TODO el stock,
// no solo la página actual) reutiliza stockValorizado() ya existente.
export async function reporteInventario(query: PaginacionQuery) {
  const [{ datos, total }, resumenGeneral] = await Promise.all([
    reportesRepository.stockPaginado(
      { pagina: query.pagina, porPagina: query.porPagina },
      query.busqueda,
      { ordenarPor: query.ordenarPor, direccion: query.direccion },
    ),
    stockValorizado(),
  ]);

  return {
    datos: datos.map((s) => ({
      id: s.id,
      producto: s.producto.nombre,
      categoria: s.producto.categoria?.nombre ?? "-",
      marca: s.producto.marca?.nombre ?? "-",
      cantidad: s.cantidad,
      stockBajo: s.cantidad <= s.producto.stockMinimo,
      valorCosto: s.cantidad * Number(s.producto.precioCosto),
      valorVenta: s.cantidad * Number(s.producto.precioVenta),
    })),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    resumen: {
      totalValorCosto: resumenGeneral.totalValorCosto,
      totalValorVenta: resumenGeneral.totalValorVenta,
    },
  };
}

// Clientes con su actividad de compra en el período + saldo de cuenta
// corriente actual (no depende del rango: es la foto de hoy).
export async function reporteClientes(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const { datos, total } = await reportesRepository.clientesPaginado(
    { pagina: query.pagina, porPagina: query.porPagina },
    query.busqueda,
    { ordenarPor: query.ordenarPor, direccion: query.direccion },
  );

  const ids = datos.map((c) => c.id);
  const [compras, saldos] = await Promise.all([
    reportesRepository.comprasPorCliente(ids, rango),
    reportesRepository.saldosClientes(ids),
  ]);

  return {
    datos: datos.map((c) => {
      const compra = compras.find((x) => x.clienteId === c.id);
      const saldo = saldos.find((x) => x.clienteId === c.id);
      return {
        id: c.id,
        nombre: c.nombre,
        documento: c.documento,
        cantidadCompras: compra?._count._all ?? 0,
        totalComprado: Number(compra?._sum.total ?? 0),
        saldoCuentaCorriente: Number(saldo?.saldoNuevo ?? 0),
      };
    }),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
  };
}

// Rendimiento por vendedor/cajero: ventas generadas + resultado de las cajas
// que abrió en el período.
export async function reporteCajeros(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const { datos, total } = await reportesRepository.usuariosPaginado(
    { pagina: query.pagina, porPagina: query.porPagina },
    query.busqueda,
    { ordenarPor: query.ordenarPor, direccion: query.direccion },
  );

  const ids = datos.map((u) => u.id);
  const [ventasAgg, cajasAgg] = await Promise.all([
    reportesRepository.ventasAgregadasPorUsuario(ids, rango),
    reportesRepository.cajasAgregadasPorUsuario(ids, rango),
  ]);

  return {
    datos: datos.map((u) => {
      const ventas = ventasAgg.find((v) => v.usuarioId === u.id);
      const cajas = cajasAgg.find((c) => c.usuarioAperturaId === u.id);
      return {
        id: u.id,
        nombre: u.nombre,
        rol: u.rol.nombre,
        cantidadVentas: ventas?._count._all ?? 0,
        totalVendido: Number(ventas?._sum.total ?? 0),
        cantidadCajas: cajas?._count._all ?? 0,
        diferenciaCajas: Number(cajas?._sum.diferencia ?? 0),
      };
    }),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
  };
}

// Cuánto se cobró por cada medio de pago y qué porcentaje del total
// representa. Son pocos medios (EFECTIVO, DEBITO, ...): se pagina en JS
// (ver paginarYOrdenar) solo para mantener la misma forma de respuesta.
export async function reporteMediosPago(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const { agrupado, medios } = await reportesRepository.mediosPagoAgregados(rango);
  const totalGeneral = agrupado.reduce((acc, g) => acc + Number(g._sum.monto ?? 0), 0);

  const filas = agrupado.map((g) => {
    const medio = medios.find((m) => m.id === g.medioPagoId);
    const totalCobrado = Number(g._sum.monto ?? 0);
    return {
      medioPagoId: g.medioPagoId,
      nombre: medio?.nombre ?? "Desconocido",
      cantidadTransacciones: g._count._all,
      totalCobrado,
      porcentaje: totalGeneral > 0 ? (totalCobrado / totalGeneral) * 100 : 0,
    };
  });

  return paginarYOrdenar(filas, query, {
    totalCobrado: (f) => f.totalCobrado,
    cantidadTransacciones: (f) => f.cantidadTransacciones,
    nombre: (f) => f.nombre,
  });
}

// Margen por producto (a diferencia de reporteProductos, que ordena por
// unidades/facturado). El resumen reutiliza rentabilidad() ya existente.
export async function reporteGanancias(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const [{ agrupado, productos }, resumen] = await Promise.all([
    reportesRepository.productosVendidosPeriodo(rango, query.busqueda),
    rentabilidad(rango),
  ]);

  const filas = agrupado.map((g) => {
    const producto = productos.find((p) => p.id === g.productoId);
    const cantidadVendida = g._sum.cantidad ?? 0;
    const totalVendido = Number(g._sum.subtotal ?? 0);
    const costoTotal = (producto ? Number(producto.precioCosto) : 0) * cantidadVendida;
    const margen = totalVendido - costoTotal;
    return {
      productoId: g.productoId,
      nombre: producto?.nombre ?? "Producto eliminado",
      cantidadVendida,
      totalVendido,
      costoTotal,
      margen,
      margenPorcentual: totalVendido > 0 ? (margen / totalVendido) * 100 : 0,
    };
  });

  const pagina = paginarYOrdenar(filas, query, {
    margen: (f) => f.margen,
    margenPorcentual: (f) => f.margenPorcentual,
    totalVendido: (f) => f.totalVendido,
    cantidadVendida: (f) => f.cantidadVendida,
    nombre: (f) => f.nombre,
  });

  return { ...pagina, resumen };
}

export async function reporteDevoluciones(query: ReporteQuery) {
  const rango = resolverRango({ desde: query.desde, hasta: query.hasta });
  const [{ datos, total }, resumenAgg] = await Promise.all([
    reportesRepository.devolucionesPaginadas(
      rango,
      { pagina: query.pagina, porPagina: query.porPagina },
      query.busqueda,
      { ordenarPor: query.ordenarPor, direccion: query.direccion },
    ),
    reportesRepository.devolucionesResumenPeriodo(rango),
  ]);

  return {
    datos: datos.map((d) => ({
      id: d.id,
      fecha: d.createdAt,
      ventaOriginal: d.ventaOriginal.numero,
      cliente: d.cliente?.nombre ?? "Consumidor final",
      tipo: d.tipo,
      montoReintegro: Number(d.montoReintegro),
      motivo: d.motivo ?? "-",
      usuario: d.usuario.nombre,
    })),
    total,
    pagina: query.pagina,
    porPagina: query.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    resumen: {
      cantidadDevoluciones: resumenAgg._count._all,
      montoTotalReintegrado: Number(resumenAgg._sum.montoReintegro ?? 0),
    },
  };
}
