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

describe("ventas", () => {
  const app = getApp();
  let token: string;
  let productoId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    await cerrarSiHayAbierta(app, token);
    await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 5000 });

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto venta test",
        codigoInterno: codigoUnico("VTA"),
        precioCosto: 1000,
        precioVenta: 2500,
        stockMinimo: 0,
      });
    productoId = producto.body.id;
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidad: 10, motivo: "stock inicial" });
  });

  it("rechaza una venta donde los pagos no cubren el total", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 100, recargo: 0 }],
      });
    expect(res.status).toBe(422);
  });

  it("crea una venta con pago mixto, descuenta stock y solo mueve el efectivo en caja", async () => {
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 2, precioUnitario: 2500, descuento: 0 }],
        pagos: [
          { medioPago: "EFECTIVO", monto: 2000, recargo: 0 },
          { medioPago: "DEBITO", monto: 3000, recargo: 0 },
        ],
      });
    expect(venta.status).toBe(201);
    expect(Number(venta.body.total)).toBe(5000);

    const stock = await request(app)
      .get(`/api/stock/producto/${productoId}`)
      .set("Authorization", `Bearer ${token}`);
    const cantidadTotal = stock.body.reduce((acc: number, s: { cantidad: number }) => acc + s.cantidad, 0);
    expect(cantidadTotal).toBe(8); // 10 - 2

    const cajaAbierta = await request(app)
      .get("/api/caja/abierta")
      .set("Authorization", `Bearer ${token}`);
    const movimientos = await request(app)
      .get(`/api/caja/${cajaAbierta.body.id}/movimientos`)
      .set("Authorization", `Bearer ${token}`);
    const movimientoVenta = movimientos.body.find(
      (m: { concepto: string }) => m.concepto === `Venta #${venta.body.id}`,
    );
    expect(Number(movimientoVenta.monto)).toBe(2000); // solo la porción en efectivo
  });

  it("anula una venta y revierte stock y efectivo", async () => {
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
      });

    const stockAntes = await request(app)
      .get(`/api/stock/producto/${productoId}`)
      .set("Authorization", `Bearer ${token}`);
    const cantidadAntes = stockAntes.body.reduce((acc: number, s: { cantidad: number }) => acc + s.cantidad, 0);

    const anular = await request(app)
      .post(`/api/ventas/${venta.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "test de anulación" });
    expect(anular.status).toBe(200);
    expect(anular.body.estado).toBe("ANULADA");

    const stockDespues = await request(app)
      .get(`/api/stock/producto/${productoId}`)
      .set("Authorization", `Bearer ${token}`);
    const cantidadDespues = stockDespues.body.reduce((acc: number, s: { cantidad: number }) => acc + s.cantidad, 0);
    expect(cantidadDespues).toBe(cantidadAntes + 1);

    const segundaAnulacion = await request(app)
      .post(`/api/ventas/${venta.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "otra vez" });
    expect(segundaAnulacion.status).toBe(422);
  });

  it("ignora el precioUnitario manipulado y usa siempre el precio real del catálogo", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        // El producto vale 2500 en el catálogo; se intenta comprar a $0.01.
        items: [{ productoId, cantidad: 1, precioUnitario: 0.01, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 0.01, recargo: 0 }],
      });
    // Los pagos (0.01) ya no cubren el total real (2500) → rechazada.
    expect(res.status).toBe(422);
  });

  it("una venta creada con precioUnitario manipulado pero pagos correctos usa el precio real, no el enviado", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 1, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(2500);
    expect(Number(res.body.items[0].precioUnitario)).toBe(2500);
  });

  it("rechaza un descuento de ítem mayor a su propio subtotal", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 9999 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 0.01, recargo: 0 }],
      });
    expect(res.status).toBe(422);
  });

  it("rechaza un descuentoTotal mayor al subtotal de la venta", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
        descuentoTotal: 9999,
        pagos: [{ medioPago: "EFECTIVO", monto: 0.01, recargo: 0 }],
      });
    expect(res.status).toBe(422);
  });

  it("el numero se deriva del id (siempre único, sin depender de un conteo previo)", async () => {
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
      });
    expect(venta.status).toBe(201);
    expect(venta.body.numero).toBe(String(venta.body.id).padStart(8, "0"));
  });

  it("dos ventas creadas casi al mismo tiempo obtienen numeros distintos", async () => {
    const [a, b] = await Promise.all([
      request(app)
        .post("/api/ventas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
          pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
        }),
      request(app)
        .post("/api/ventas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
          pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
        }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.numero).not.toBe(b.body.numero);
  });

  it("no permite anular una venta de una caja ya cerrada", async () => {
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId, cantidad: 1, precioUnitario: 2500, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 2500, recargo: 0 }],
      });

    await request(app)
      .post("/api/caja/cerrar")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoCierreDeclarado: 0 });

    const anular = await request(app)
      .post(`/api/ventas/${venta.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "no debería poder" });
    expect(anular.status).toBe(422);
  });
});
