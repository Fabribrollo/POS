import * as XLSX from "xlsx";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

function construirXlsxBase64(
  filasProductos: unknown[][],
  filasVariantes: unknown[][],
): string {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([
      ["Código Producto", "Nombre", "Categoría", "Marca", "Precio Costo", "Precio Venta", "Descripción"],
      ...filasProductos,
    ]),
    "Productos",
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([["Código Producto", "Color", "Talle", "Stock"], ...filasVariantes]),
    "Variantes",
  );
  return (XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64");
}

describe("importación de productos por Excel", () => {
  const app = getApp();
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it("crea productos y variantes, genera SKU/código de barras y carga el stock", async () => {
    const marca = codigoUnico("Marca");
    const categoria = codigoUnico("Categoria");
    const rem = codigoUnico("REM");
    const zap = codigoUnico("ZAP");

    const archivoBase64 = construirXlsxBase64(
      [
        [rem, "Remera de test", categoria, marca, 10000, 18000, "Remera de algodón"],
        [zap, "Zapatilla de test", categoria, marca, 50000, 78000, ""],
      ],
      [
        [rem, "Blanco", "S", 15],
        [rem, "Blanco", "M", 8],
        [zap, "", "", 3], // producto sin color/talle -> variante "Único"
      ],
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.importado).toBe(true);
    expect(res.body.productosNuevos).toBe(2);
    expect(res.body.variantesNuevas).toBe(3);
    expect(res.body.errores).toHaveLength(0);

    const productos = await request(app)
      .get("/api/productos")
      .set("Authorization", `Bearer ${token}`);
    const remera = productos.body.find((p: { nombre: string }) => p.nombre === "Remera de test");
    const zapatilla = productos.body.find(
      (p: { nombre: string }) => p.nombre === "Zapatilla de test",
    );
    expect(remera.variantes).toHaveLength(2);
    expect(zapatilla.variantes).toHaveLength(1);
    expect(zapatilla.variantes[0].nombre).toBe("Único");

    for (const variante of [...remera.variantes, ...zapatilla.variantes]) {
      expect(variante.sku).toMatch(/^P\d{6}-\d{6}$/);
      expect(variante.codigoBarras).toMatch(/^3\d{12}$/);
    }

    const stockRemera = await request(app)
      .get(`/api/stock/producto/${remera.id}`)
      .set("Authorization", `Bearer ${token}`);
    const stockTotal = stockRemera.body.reduce(
      (acc: number, s: { cantidad: number }) => acc + s.cantidad,
      0,
    );
    expect(stockTotal).toBe(23); // 15 + 8
  });

  it("no importa nada si hay Código Producto duplicado en la hoja Productos", async () => {
    const codigo = codigoUnico("DUP");
    const archivoBase64 = construirXlsxBase64(
      [
        [codigo, "Producto A", "", "", 100, 200, ""],
        [codigo, "Producto B", "", "", 100, 200, ""],
      ],
      [[codigo, "", "", 1]],
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.importado).toBe(false);
    expect(res.body.errores.length).toBeGreaterThan(0);
    expect(res.body.errores[0].hoja).toBe("Productos");

    const productos = await request(app)
      .get("/api/productos")
      .set("Authorization", `Bearer ${token}`);
    expect(productos.body.find((p: { nombre: string }) => p.nombre === "Producto A")).toBeUndefined();
  });

  it("reporta variante con Código Producto inexistente", async () => {
    const codigo = codigoUnico("SOLO");
    const archivoBase64 = construirXlsxBase64(
      [[codigo, "Producto solo", "", "", 100, 200, ""]],
      [[codigo, "", "", 1], ["NO-EXISTE", "", "", 1]],
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.importado).toBe(false);
    expect(
      res.body.errores.some((e: { motivo: string }) => e.motivo.includes("NO-EXISTE")),
    ).toBe(true);
  });

  it("reporta precio no numérico y stock negativo", async () => {
    const codigo = codigoUnico("BAD");
    const archivoBase64 = construirXlsxBase64(
      [[codigo, "Producto malo", "", "", "no-es-numero", 200, ""]],
      [[codigo, "", "", -5]],
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.importado).toBe(false);
    expect(res.body.errores.length).toBeGreaterThan(0);
  });

  it("reporta un producto sin ninguna variante definida", async () => {
    const codigo = codigoUnico("SINVAR");
    const archivoBase64 = construirXlsxBase64(
      [[codigo, "Producto sin variantes", "", "", 100, 200, ""]],
      [],
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.importado).toBe(false);
    expect(
      res.body.errores.some((e: { motivo: string }) => e.motivo.includes("no tiene ninguna variante")),
    ).toBe(true);
  });

  it("rechaza un archivo al que le falta una hoja", async () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([["Código Producto", "Nombre", "Categoría", "Marca", "Precio Costo", "Precio Venta", "Descripción"]]),
      "Productos",
    );
    const archivoBase64 = (XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer).toString(
      "base64",
    );

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${token}`)
      .send({ archivoBase64 });

    expect(res.status).toBe(400);
  });
});
