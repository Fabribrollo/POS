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
    expect(buscar.body.tipo).toBe("producto"); // sin variantes todavía: se agrega directo
    expect(buscar.body.producto.id).toBe(crear.body.id);
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

  it("crea variantes con color/talle/stock, genera nombre/sku/codigoBarras y suma el stock en el producto", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Con variantes", precioCosto: 100, precioVenta: 200, stockMinimo: 0 });
    expect(producto.body.stockTotal).toBe(0);

    const variante = await request(app)
      .post(`/api/productos/${producto.body.id}/variantes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ color: "Azul", talle: "M", stock: 10 });
    expect(variante.status).toBe(201);
    expect(variante.body.nombre).toBe("Azul / M");
    expect(variante.body.sku).toMatch(/^P\d{6}-\d{6}$/);
    expect(variante.body.codigoBarras).toMatch(/^3\d{12}$/);

    const listado = await request(app)
      .get(`/api/productos/${producto.body.id}/variantes`)
      .set("Authorization", `Bearer ${token}`);
    expect(listado.body[0].stock).toBe(10);

    const editada = await request(app)
      .patch(`/api/productos/variantes/${variante.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ talle: "L", stock: 25 });
    expect(editada.status).toBe(200);
    expect(editada.body.nombre).toBe("Azul / L");

    const productoActualizado = await request(app)
      .get(`/api/productos/${producto.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(productoActualizado.body.stockTotal).toBe(25);
  });

  it("el filtro de estado excluye/incluye productos inactivos y reactivar los devuelve al listado", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Para desactivar", precioCosto: 100, precioVenta: 200, stockMinimo: 0 });

    await request(app)
      .delete(`/api/productos/${producto.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    const activos = await request(app)
      .get("/api/productos")
      .set("Authorization", `Bearer ${token}`);
    expect(activos.body.some((p: { id: number }) => p.id === producto.body.id)).toBe(false);

    const inactivos = await request(app)
      .get("/api/productos")
      .query({ estado: "inactivos" })
      .set("Authorization", `Bearer ${token}`);
    expect(inactivos.body.some((p: { id: number }) => p.id === producto.body.id)).toBe(true);

    const todos = await request(app)
      .get("/api/productos")
      .query({ estado: "todos" })
      .set("Authorization", `Bearer ${token}`);
    expect(todos.body.some((p: { id: number }) => p.id === producto.body.id)).toBe(true);

    await request(app)
      .post(`/api/productos/${producto.body.id}/reactivar`)
      .set("Authorization", `Bearer ${token}`);

    const activosDespues = await request(app)
      .get("/api/productos")
      .set("Authorization", `Bearer ${token}`);
    expect(activosDespues.body.some((p: { id: number }) => p.id === producto.body.id)).toBe(true);
  });

  it("el escaneo resuelve directo a la variante por su propio código, y con una sola variante también resuelve directo", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Una sola variante", precioCosto: 100, precioVenta: 200, stockMinimo: 0 });
    const variante = await request(app)
      .post(`/api/productos/${producto.body.id}/variantes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ color: "Verde", talle: "S", stock: 5 });

    const porBarras = await request(app)
      .get(`/api/productos/buscar/${variante.body.codigoBarras}`)
      .set("Authorization", `Bearer ${token}`);
    expect(porBarras.body.tipo).toBe("variante");
    expect(porBarras.body.variante.id).toBe(variante.body.id);

    const porCodigoProducto = await request(app)
      .get(`/api/productos/buscar/${producto.body.codigoBarras}`)
      .set("Authorization", `Bearer ${token}`);
    expect(porCodigoProducto.body.tipo).toBe("variante"); // única variante: no hace falta elegir
    expect(porCodigoProducto.body.variante.id).toBe(variante.body.id);
  });

  it("el escaneo del código del producto pide elegir variante cuando hay más de una", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Multiples variantes", precioCosto: 100, precioVenta: 200, stockMinimo: 0 });
    await request(app)
      .post(`/api/productos/${producto.body.id}/variantes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ color: "Negro", talle: "S", stock: 1 });
    await request(app)
      .post(`/api/productos/${producto.body.id}/variantes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ color: "Negro", talle: "M", stock: 1 });

    const escaneo = await request(app)
      .get(`/api/productos/buscar/${producto.body.codigoBarras}`)
      .set("Authorization", `Bearer ${token}`);
    expect(escaneo.body.tipo).toBe("elegir_variante");
    expect(escaneo.body.producto.variantes).toHaveLength(2);
  });
});
