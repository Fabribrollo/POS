import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { codigoUnico, getApp, loginAsAdmin } from "./helpers.js";

describe("compras", () => {
  const app = getApp();
  let token: string;
  let proveedorId: number;
  let productoId: number;

  beforeAll(async () => {
    token = await loginAsAdmin(app);

    const proveedor = await request(app)
      .post("/api/proveedores")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Proveedor compras test" });
    proveedorId = proveedor.body.id;

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto compras test",
        codigoInterno: codigoUnico("COMPRA"),
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 0,
      });
    productoId = producto.body.id;
  });

  it("crea una compra y el numero se deriva del id", async () => {
    const res = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({
        proveedorId,
        items: [{ productoId, cantidad: 5, precioUnitario: 100 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.numero).toBe(`OC-${String(res.body.id).padStart(6, "0")}`);
    expect(res.body.estado).toBe("PENDIENTE");
  });

  it("dos compras casi simultáneas obtienen numeros distintos", async () => {
    const [a, b] = await Promise.all([
      request(app)
        .post("/api/compras")
        .set("Authorization", `Bearer ${token}`)
        .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] }),
      request(app)
        .post("/api/compras")
        .set("Authorization", `Bearer ${token}`)
        .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.numero).not.toBe(b.body.numero);
  });

  it("rechaza una compra a un proveedor dado de baja", async () => {
    const proveedorBaja = await request(app)
      .post("/api/proveedores")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Proveedor de baja test" });
    await request(app)
      .delete(`/api/proveedores/${proveedorBaja.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({
        proveedorId: proveedorBaja.body.id,
        items: [{ productoId, cantidad: 1, precioUnitario: 100 }],
      });
    expect(res.status).toBe(422);
  });

  it("rechaza un precioUnitario de $0", async () => {
    const res = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 0 }] });
    expect(res.status).toBe(400);
  });

  it("recibir una compra mueve stock y actualiza el precioCosto del producto", async () => {
    const compra = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({
        proveedorId,
        items: [{ productoId, cantidad: 3, precioUnitario: 150 }],
      });

    const recibir = await request(app)
      .post(`/api/compras/${compra.body.id}/recibir`)
      .set("Authorization", `Bearer ${token}`);
    expect(recibir.status).toBe(200);
    expect(recibir.body.estado).toBe("RECIBIDA");

    const producto = await request(app)
      .get(`/api/productos/${productoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(Number(producto.body.precioCosto)).toBe(150);
  });

  it("no permite recibir dos veces la misma compra", async () => {
    const compra = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] });
    await request(app)
      .post(`/api/compras/${compra.body.id}/recibir`)
      .set("Authorization", `Bearer ${token}`);

    const segunda = await request(app)
      .post(`/api/compras/${compra.body.id}/recibir`)
      .set("Authorization", `Bearer ${token}`);
    expect(segunda.status).toBe(422);
  });

  it("anula una compra pendiente pero no una ya recibida", async () => {
    const compra = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] });

    const anular = await request(app)
      .post(`/api/compras/${compra.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`);
    expect(anular.status).toBe(200);
    expect(anular.body.estado).toBe("ANULADA");

    const compraRecibida = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${token}`)
      .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] });
    await request(app)
      .post(`/api/compras/${compraRecibida.body.id}/recibir`)
      .set("Authorization", `Bearer ${token}`);

    const anularRecibida = await request(app)
      .post(`/api/compras/${compraRecibida.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`);
    expect(anularRecibida.status).toBe(422);
  });

  it("un vendedor no puede gestionar compras (403)", async () => {
    const email = `vendedor-compras-${Date.now()}@pos.local`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Vendedor compras test", email, password: "vendedor123", rol: "VENDEDOR" });
    const login = await request(app).post("/api/auth/login").send({ email, password: "vendedor123" });

    const res = await request(app)
      .post("/api/compras")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ proveedorId, items: [{ productoId, cantidad: 1, precioUnitario: 100 }] });
    expect(res.status).toBe(403);
  });
});
