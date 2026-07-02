import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

describe("stock", () => {
  const app = getApp();
  let token: string;
  let productoId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto stock test",
        codigoInterno: codigoUnico("STK"),
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 5,
      });
    productoId = producto.body.id;
  });

  it("ingresa stock y lo refleja en la cantidad", async () => {
    const res = await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidad: 10, motivo: "stock inicial" });
    expect(res.status).toBe(201);
    expect(res.body.stockNuevo).toBe(10);
  });

  it("bloquea un egreso mayor al stock disponible", async () => {
    const res = await request(app)
      .post("/api/stock/egreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidad: 999, motivo: "prueba" });
    expect(res.status).toBe(422);
  });

  it("permite un egreso dentro del stock disponible", async () => {
    const res = await request(app)
      .post("/api/stock/egreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidad: 3, motivo: "prueba" });
    expect(res.status).toBe(201);
    expect(res.body.stockNuevo).toBe(7);
  });

  it("exige motivo en un ajuste de inventario", async () => {
    const res = await request(app)
      .post("/api/stock/ajuste")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidadNueva: 20 });
    expect(res.status).toBe(400);
  });

  it("un ajuste por debajo del mínimo aparece en el reporte de stock bajo", async () => {
    await request(app)
      .post("/api/stock/ajuste")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidadNueva: 2, motivo: "conteo físico" });

    const res = await request(app).get("/api/stock/bajo").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: number }) => p.id === productoId)).toBe(true);
  });
});
