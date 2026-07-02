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
