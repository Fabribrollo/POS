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

describe("auditoria", () => {
  const app = getApp();
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it("un VENDEDOR no puede ver el registro de auditoría (403)", async () => {
    const email = `vendedor-${Date.now()}@pos.local`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Vendedor test", email, password: "vendedor123", rol: "VENDEDOR" });

    const login = await request(app).post("/api/auth/login").send({ email, password: "vendedor123" });
    const tokenVendedor = login.body.token as string;

    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${tokenVendedor}`);
    expect(res.status).toBe(403);
  });

  it("admin puede ver el registro de auditoría (200)", async () => {
    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("datos");
    expect(res.body).toHaveProperty("total");
  });

  it("crear un producto genera una entrada CREAR/Producto", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto auditoria test",
        codigoInterno: codigoUnico("AUD-PROD"),
        precioCosto: 100,
        precioVenta: 200,
        stockMinimo: 0,
      });
    expect(producto.status).toBe(201);

    const logs = await request(app)
      .get(`/api/auditoria?entidad=Producto&accion=CREAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    expect(logs.status).toBe(200);
    const encontrado = logs.body.datos.some((l: { entidadId: number }) => l.entidadId === producto.body.id);
    expect(encontrado).toBe(true);
  });

  it("cambiar el precioVenta de un producto genera ACTUALIZAR/Producto con antes/después", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto precio test",
        codigoInterno: codigoUnico("AUD-PRECIO"),
        precioCosto: 100,
        precioVenta: 500,
        stockMinimo: 0,
      });

    await request(app)
      .patch(`/api/productos/${producto.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ precioVenta: 800 });

    const logs = await request(app)
      .get(`/api/auditoria?entidad=Producto&accion=ACTUALIZAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    const entrada = logs.body.datos.find((l: { entidadId: number }) => l.entidadId === producto.body.id);
    expect(entrada).toBeDefined();
    expect(entrada.detalle.precioVenta).toEqual({ antes: 500, despues: 800 });
  });

  it("editar un producto SIN cambiar precio no genera una entrada ACTUALIZAR nueva", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto sin cambio precio",
        codigoInterno: codigoUnico("AUD-SINCAMBIO"),
        precioCosto: 100,
        precioVenta: 300,
        stockMinimo: 0,
      });

    await request(app)
      .patch(`/api/productos/${producto.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Producto sin cambio precio (editado)" });

    const logs = await request(app)
      .get(`/api/auditoria?entidad=Producto&accion=ACTUALIZAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    const entrada = logs.body.datos.find((l: { entidadId: number }) => l.entidadId === producto.body.id);
    expect(entrada).toBeUndefined();
  });

  it("un ajuste manual de stock genera ACTUALIZAR/Stock", async () => {
    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto ajuste stock",
        codigoInterno: codigoUnico("AUD-STOCK"),
        precioCosto: 10,
        precioVenta: 20,
        stockMinimo: 0,
      });

    await request(app)
      .post("/api/stock/ajuste")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidadNueva: 15, motivo: "Conteo físico" });

    const logs = await request(app)
      .get(`/api/auditoria?entidad=Stock&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    const entrada = logs.body.datos.find((l: { entidadId: number }) => l.entidadId === producto.body.id);
    expect(entrada).toBeDefined();
    expect(entrada.detalle.tipo).toBe("AJUSTE");
    expect(entrada.detalle.stockNuevo).toBe(15);
  });

  it("abrir y cerrar caja genera ABRIR/Caja y CERRAR/Caja", async () => {
    await cerrarSiHayAbierta(app, token);

    const abierta = await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 500 });
    expect(abierta.status).toBe(201);

    await request(app)
      .post("/api/caja/cerrar")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoCierreDeclarado: 500 });

    const logsAbrir = await request(app)
      .get(`/api/auditoria?entidad=Caja&accion=ABRIR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    const logsCerrar = await request(app)
      .get(`/api/auditoria?entidad=Caja&accion=CERRAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);

    expect(logsAbrir.body.datos.some((l: { entidadId: number }) => l.entidadId === abierta.body.id)).toBe(true);
    expect(logsCerrar.body.datos.some((l: { entidadId: number }) => l.entidadId === abierta.body.id)).toBe(true);
  });

  it("crear una venta genera CREAR/Venta y anularla genera ANULAR/Venta", async () => {
    await cerrarSiHayAbierta(app, token);
    await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 1000 });

    const producto = await request(app)
      .post("/api/productos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Producto venta auditoria",
        codigoInterno: codigoUnico("AUD-VENTA"),
        precioCosto: 1000,
        precioVenta: 3000,
        stockMinimo: 0,
      });
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId: producto.body.id, cantidad: 5, motivo: "stock inicial" });

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productoId: producto.body.id, cantidad: 1, precioUnitario: 3000, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 3000, recargo: 0 }],
      });
    expect(venta.status).toBe(201);

    const logsCrear = await request(app)
      .get(`/api/auditoria?entidad=Venta&accion=CREAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    expect(logsCrear.body.datos.some((l: { entidadId: number }) => l.entidadId === venta.body.id)).toBe(true);

    await request(app)
      .post(`/api/ventas/${venta.body.id}/anular`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "Prueba de auditoría" });

    const logsAnular = await request(app)
      .get(`/api/auditoria?entidad=Venta&accion=ANULAR&porPagina=200`)
      .set("Authorization", `Bearer ${token}`);
    const entrada = logsAnular.body.datos.find((l: { entidadId: number }) => l.entidadId === venta.body.id);
    expect(entrada).toBeDefined();
    expect(entrada.detalle.motivo).toBe("Prueba de auditoría");
  });

  it("filtra por usuarioId correctamente", async () => {
    const res = await request(app)
      .get(`/api/auditoria?usuarioId=999999`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos).toHaveLength(0);
  });
});
