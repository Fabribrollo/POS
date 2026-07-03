import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { getApp, loginAsAdmin } from "./helpers.js";

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
        precioCosto: 1000,
        precioVenta: 500,
        stockMinimo: 0,
      });
    expect(res.status).toBe(400);
  });

  it("genera codigoInterno y codigoBarras automáticamente y lo encuentra por código de barras", async () => {
    const crear = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto de test",
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 1,
      });
    expect(crear.status).toBe(201);
    expect(crear.body.codigoInterno).toMatch(/^P\d{6}$/);
    expect(crear.body.codigoBarras).toMatch(/^2\d{12}$/);

    const buscar = await request(app)
      .get(`/api/productos/buscar/${crear.body.codigoBarras}`)
      .set("Authorization", `Bearer ${token}`);
    expect(buscar.status).toBe(200);
    expect(buscar.body.id).toBe(crear.body.id);
  });

  it("nunca genera codigoInterno ni codigoBarras repetidos entre dos productos", async () => {
    const datos = { nombre: "Repetido", precioCosto: 10, precioVenta: 20, stockMinimo: 0 };

    const primero = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send(datos);
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send(datos);
    expect(segundo.status).toBe(201);

    expect(segundo.body.codigoInterno).not.toBe(primero.body.codigoInterno);
    expect(segundo.body.codigoBarras).not.toBe(primero.body.codigoBarras);
  });
});
