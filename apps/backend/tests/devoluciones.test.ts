import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

async function cerrarSiHayAbierta(app: ReturnType<typeof getApp>, token: string) {
  const abierta = await request(app).get("/api/caja/abierta").set("Authorization", `Bearer ${token}`);
  if (abierta.status === 200) {
    await request(app)
      .post("/api/caja/cerrar")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoCierreDeclarado: 0 });
  }
}

describe("devoluciones", () => {
  const app = getApp();
  let token: string;
  let ventaId: number;
  let itemVentaId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    await cerrarSiHayAbierta(app, token);
    await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 1000 });

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto devolución test",
        codigoInterno: codigoUnico("DEV"),
        precioCosto: 1000,
        precioVenta: 2500,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 10, motivo: "stock inicial" });

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId: producto.body.id, cantidad: 3, precioUnitario: 2500, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 7500, recargo: 0 }],
      });
    ventaId = venta.body.id;
    itemVentaId = venta.body.items[0].id;
  });

  it("procesa un reintegro parcial y repone stock", async () => {
    const res = await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: ventaId,
        tipo: "REINTEGRO",
        montoReintegro: 2500,
        items: [{ itemVentaId, cantidad: 1 }],
      });
    expect(res.status).toBe(201);
  });

  it("no permite devolver más unidades de las que quedan disponibles", async () => {
    // De 3 unidades ya se devolvió 1; pedir las 3 originales de nuevo debe fallar.
    const res = await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: ventaId,
        tipo: "REINTEGRO",
        montoReintegro: 7500,
        items: [{ itemVentaId, cantidad: 3 }],
      });
    expect(res.status).toBe(422);
  });

  it("permite devolver exactamente lo que queda disponible (2 unidades)", async () => {
    const res = await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: ventaId,
        tipo: "REINTEGRO",
        montoReintegro: 5000,
        items: [{ itemVentaId, cantidad: 2 }],
      });
    expect(res.status).toBe(201);
  });
});

describe("devoluciones - nota de crédito y saldo a favor", () => {
  const app = getApp();
  let token: string;
  let ventaSinCliente: number;
  let itemSinCliente: number;
  let numeroVenta: string;
  let clienteId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    await cerrarSiHayAbierta(app, token);
    await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 1000 });

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto nota crédito test",
        codigoInterno: codigoUnico("NC"),
        precioCosto: 1000,
        precioVenta: 3000,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 10, motivo: "stock inicial" });

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId: producto.body.id, cantidad: 2, precioUnitario: 3000, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 6000, recargo: 0 }],
      });
    ventaSinCliente = venta.body.id;
    itemSinCliente = venta.body.items[0].id;
    numeroVenta = venta.body.numero;
  });

  it("rechaza una nota de crédito si la venta no tiene cliente y no se indica uno", async () => {
    const res = await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: ventaSinCliente,
        tipo: "NOTA_CREDITO",
        items: [{ itemVentaId: itemSinCliente, cantidad: 1 }],
      });
    expect(res.status).toBe(422);
  });

  it("crea el cliente indicado y acredita el saldo a favor calculado del ítem, ignorando el montoReintegro recibido", async () => {
    const cliente = await request(app)
      .post("/api/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Cliente devolución test" });
    clienteId = cliente.body.id;

    const res = await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: ventaSinCliente,
        tipo: "NOTA_CREDITO",
        clienteId,
        montoReintegro: 999999, // debe ser ignorado: se recalcula del precio real del ítem
        items: [{ itemVentaId: itemSinCliente, cantidad: 1 }],
      });
    expect(res.status).toBe(201);

    const saldo = await request(app)
      .get(`/api/clientes/${clienteId}/cuenta-corriente/saldo`)
      .set("Authorization", `Bearer ${token}`);
    expect(saldo.body.saldo).toBe(-3000);
  });

  it("GET /devoluciones/buscar/:numero informa la disponibilidad restante por ítem", async () => {
    const res = await request(app)
      .get(`/api/devoluciones/buscar/${numeroVenta}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items[0].cantidad).toBe(2);
    expect(res.body.items[0].cantidadDevuelta).toBe(1);
    expect(res.body.items[0].cantidadDisponible).toBe(1);
  });

  it("permite pagar una venta nueva con el saldo a favor del cliente", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto pagado con saldo",
        codigoInterno: codigoUnico("SF"),
        precioCosto: 500,
        precioVenta: 3000,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 5, motivo: "stock inicial" });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        clienteId,
        items: [{ productoId: producto.body.id, cantidad: 1, precioUnitario: 3000, descuento: 0 }],
        pagos: [{ medioPago: "SALDO_A_FAVOR", monto: 3000, recargo: 0 }],
      });
    expect(res.status).toBe(201);

    const saldo = await request(app)
      .get(`/api/clientes/${clienteId}/cuenta-corriente/saldo`)
      .set("Authorization", `Bearer ${token}`);
    expect(saldo.body.saldo).toBe(0);
  });

  it("rechaza el pago con saldo a favor si excede el crédito disponible", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto sin saldo suficiente",
        codigoInterno: codigoUnico("SF2"),
        precioCosto: 500,
        precioVenta: 5000,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 5, motivo: "stock inicial" });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        clienteId,
        items: [{ productoId: producto.body.id, cantidad: 1, precioUnitario: 5000, descuento: 0 }],
        pagos: [{ medioPago: "SALDO_A_FAVOR", monto: 5000, recargo: 0 }],
      });
    expect(res.status).toBe(422);
  });

  it("rechaza el pago con saldo a favor si la venta no tiene cliente asociado", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto saldo sin cliente",
        codigoInterno: codigoUnico("SF3"),
        precioCosto: 500,
        precioVenta: 1000,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 5, motivo: "stock inicial" });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId: producto.body.id, cantidad: 1, precioUnitario: 1000, descuento: 0 }],
        pagos: [{ medioPago: "SALDO_A_FAVOR", monto: 1000, recargo: 0 }],
      });
    expect(res.status).toBe(422);
  });
});
