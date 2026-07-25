import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/core/prisma.js";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

describe("listas de precio", () => {
  const app = getApp();
  let token: string;
  let productoId: number;
  let listaId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto lista precio test",
        codigoInterno: codigoUnico("LISTA"),
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 0,
      });
    productoId = producto.body.id;

    const lista = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: codigoUnico("Mayorista") });
    listaId = lista.body.id;
  });

  it("asigna un precio a un producto en una lista existente", async () => {
    const res = await request(app)
      .post("/api/listas-precio/asignar")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, listaPrecioId: listaId, precio: 180 });
    expect(res.status).toBe(201);
    expect(Number(res.body.precio)).toBe(180);
  });

  it("rechaza asignar un precio a una lista de precios inexistente", async () => {
    const res = await request(app)
      .post("/api/listas-precio/asignar")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, listaPrecioId: 999999, precio: 180 });
    expect(res.status).toBe(404);
  });

  it("rechaza asignar un precio a una lista dada de baja", async () => {
    // No hay endpoint de baja de listas de precio expuesto todavía: se
    // desactiva directo para poder probar esta regla de negocio igual.
    const listaBaja = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: codigoUnico("ListaDeBaja") });

    await prisma.listaPrecio.update({ where: { id: listaBaja.body.id }, data: { activo: false } });

    const res = await request(app)
      .post("/api/listas-precio/asignar")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, listaPrecioId: listaBaja.body.id, precio: 180 });
    expect(res.status).toBe(422);
  });

  it("rechaza un precio de $0", async () => {
    const res = await request(app)
      .post("/api/listas-precio/asignar")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, listaPrecioId: listaId, precio: 0 });
    expect(res.status).toBe(400);
  });

  it("no permite crear dos listas con el mismo nombre", async () => {
    const nombre = codigoUnico("Duplicada");
    await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre });
    const res = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre });
    expect(res.status).toBe(422);
  });
});
