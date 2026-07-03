import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

describe("importación de productos por CSV", () => {
  const app = getApp();
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it("crea productos con variantes, reutiliza categoría/marca sin distinguir mayúsculas y reporta errores por fila", async () => {
    const marca = codigoUnico("Marca");
    const categoria = codigoUnico("Categoria");
    const csv = [
      "producto,variante,categoria,marca,stock,precioCosto,precioVenta",
      ",Variante huérfana,,,,,", // primera fila, sin producto arriba -> error
      `Remera,,${categoria},${marca},10,100,200`,
      ",Talle S,,,,,190",
      ",Talle M,,,,,",
      `Gorra,,${categoria.toUpperCase()},${marca.toUpperCase()},5,50,100`,
    ].join("\n");

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ contenido: csv });

    expect(res.status).toBe(200);
    expect(res.body.productosCreados).toBe(2);
    expect(res.body.variantesCreadas).toBe(2);
    expect(res.body.errores).toHaveLength(1);

    const productos = await request(app)
      .get("/api/productos")
      .set("Authorization", `Bearer ${token}`);
    const remera = productos.body.find((p: { nombre: string }) => p.nombre === "Remera");
    const gorra = productos.body.find((p: { nombre: string }) => p.nombre === "Gorra");
    expect(remera.categoria.nombre).toBe(categoria);
    expect(gorra.categoria.id).toBe(remera.categoria.id); // mismo id pese a mayúsculas distintas
    expect(remera.variantes).toHaveLength(2);
  });
});
