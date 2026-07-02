import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

describe("productos", () => {
  const app = getApp();
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it("rechaza precioVenta menor a precioCosto", async () => {
    const res = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto inválido",
        codigoInterno: codigoUnico("BAD"),
        precioCosto: 1000,
        precioVenta: 500,
        stockMinimo: 0,
      });
    expect(res.status).toBe(400);
  });

  it("crea un producto válido y lo encuentra por código de barras", async () => {
    const codigoBarras = codigoUnico("BARCODE");
    const crear = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto de test",
        codigoInterno: codigoUnico("INT"),
        codigoBarras,
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 1,
      });
    expect(crear.status).toBe(201);

    const buscar = await request(app)
      .get(`/api/productos/buscar/${codigoBarras}`)
      .set("Authorization", `Bearer ${token}`);
    expect(buscar.status).toBe(200);
    expect(buscar.body.id).toBe(crear.body.id);
  });

  it("rechaza codigoInterno duplicado (409)", async () => {
    const codigoInterno = codigoUnico("DUP");
    const primero = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "A", codigoInterno, precioCosto: 10, precioVenta: 20, stockMinimo: 0 });
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "B", codigoInterno, precioCosto: 10, precioVenta: 20, stockMinimo: 0 });
    expect(segundo.status).toBe(409);
  });
});
