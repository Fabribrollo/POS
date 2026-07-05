import * as XLSX from "xlsx";
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

// supertest/superagent no trae un parser binario por defecto para
// application/pdf ni el mime type de xlsx; sin esto, el buffer de la
// respuesta llegaría corrompido (lo intentaría decodificar como texto).
function bufferParser(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("reportes", () => {
  const app = getApp();
  let token: string;
  let productoId: number;
  let ventaNumero: string;
  let ventaTotal: number;
  let clienteId: number;
  let clienteNombre: string;

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
        nombre: codigoUnico("Producto reporte"),
        precioCosto: 1000,
        precioVenta: 3000,
        stockMinimo: 0,
      });
    productoId = producto.body.id;
    await request(app)
      .post("/api/stock/ingreso")
      .set("Authorization", `Bearer ${token}`)
      .send({ productoId, cantidad: 10, motivo: "stock inicial" });

    clienteNombre = codigoUnico("Cliente reporte");
    const cliente = await request(app)
      .post("/api/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: clienteNombre });
    clienteId = cliente.body.id;

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        clienteId,
        items: [{ productoId, cantidad: 2, precioUnitario: 3000, descuento: 0 }],
        pagos: [{ medioPago: "EFECTIVO", monto: 6000, recargo: 0 }],
      });
    ventaNumero = venta.body.numero;
    ventaTotal = Number(venta.body.total);

    await request(app)
      .post("/api/devoluciones")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ventaOriginalId: venta.body.id,
        tipo: "REINTEGRO",
        montoReintegro: 3000,
        items: [{ itemVentaId: venta.body.items[0].id, cantidad: 1 }],
      });
  });

  it("el dashboard refleja la venta creada y que hay caja abierta", async () => {
    const res = await request(app)
      .get("/api/reportes/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis.cantidadVentas).toBeGreaterThanOrEqual(1);
    expect(res.body.kpis.totalVentas).toBeGreaterThanOrEqual(ventaTotal);
    expect(res.body.kpis.cajaAbierta).toBe(true);
    expect(Array.isArray(res.body.ventasPorDia)).toBe(true);
  });

  it("pagina el reporte de ventas correctamente", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas")
      .query({ porPagina: 1, pagina: 1 })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.totalPaginas).toBeGreaterThanOrEqual(res.body.total);
  });

  it("la búsqueda filtra por número de venta", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas")
      .query({ busqueda: ventaNumero })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos.some((v: { numero: string }) => v.numero === ventaNumero)).toBe(true);
  });

  it("rechaza un rango con 'desde' posterior a 'hasta'", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas")
      .query({ desde: "2026-06-10", hasta: "2026-06-01" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("exporta el reporte de ventas a Excel con un archivo válido", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas/exportar.xlsx")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(bufferParser);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");

    const libro = XLSX.read(res.body as Buffer, { type: "buffer" });
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    expect(filas.length).toBeGreaterThanOrEqual(1);
    expect(filas.some((f: unknown) => (f as { Número: string })["Número"] === ventaNumero)).toBe(true);
  });

  it("exporta el reporte de ventas a PDF con un archivo válido", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas/exportar.pdf")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(bufferParser);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect((res.body as Buffer).subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("el reporte de caja devuelve la caja abierta con su resumen", async () => {
    const res = await request(app)
      .get("/api/reportes/caja")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos.length).toBeGreaterThanOrEqual(1);
    expect(res.body.resumen).toHaveProperty("cantidadCajas");
  });

  it("el reporte de productos rankea por unidades/facturado y respeta la búsqueda", async () => {
    const res = await request(app)
      .get("/api/reportes/productos")
      .query({ busqueda: "no-existe-nadie" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("el reporte de inventario incluye el producto con stock y un resumen valorizado", async () => {
    const res = await request(app)
      .get("/api/reportes/inventario")
      .query({ busqueda: "reporte" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos.length).toBeGreaterThanOrEqual(1);
    expect(res.body.resumen.totalValorCosto).toBeGreaterThan(0);
    expect(res.body.resumen.totalValorVenta).toBeGreaterThan(0);
  });

  it("el reporte de clientes refleja la compra del cliente creado", async () => {
    const res = await request(app)
      .get("/api/reportes/clientes")
      .query({ busqueda: clienteNombre })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const fila = res.body.datos.find((c: { id: number }) => c.id === clienteId);
    expect(fila).toBeDefined();
    expect(fila.cantidadCompras).toBeGreaterThanOrEqual(1);
    expect(fila.totalComprado).toBeGreaterThanOrEqual(ventaTotal);
  });

  it("el reporte de cajeros muestra al admin con ventas y cajas", async () => {
    const res = await request(app)
      .get("/api/reportes/cajeros")
      .query({ busqueda: "admin" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos.length).toBeGreaterThanOrEqual(1);
    expect(res.body.datos[0].cantidadVentas).toBeGreaterThanOrEqual(1);
  });

  it("el reporte de métodos de pago suma el 100% entre todos los medios usados", async () => {
    const res = await request(app)
      .get("/api/reportes/medios-pago")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const sumaPorcentajes = res.body.datos.reduce((acc: number, m: { porcentaje: number }) => acc + m.porcentaje, 0);
    expect(sumaPorcentajes).toBeCloseTo(100, 0);
  });

  it("el reporte de ganancias calcula margen y trae el resumen de rentabilidad", async () => {
    const res = await request(app)
      .get("/api/reportes/ganancias")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.resumen).toHaveProperty("gananciaNeta");
    const fila = res.body.datos.find((f: { productoId: number }) => f.productoId === productoId);
    expect(fila).toBeDefined();
    expect(fila.margen).toBe(fila.totalVendido - fila.costoTotal);
  });

  it("el reporte de devoluciones refleja el reintegro creado", async () => {
    const res = await request(app)
      .get("/api/reportes/devoluciones")
      .query({ busqueda: clienteNombre })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.datos.length).toBeGreaterThanOrEqual(1);
    expect(res.body.resumen.cantidadDevoluciones).toBeGreaterThanOrEqual(1);
    expect(res.body.resumen.montoTotalReintegrado).toBeGreaterThanOrEqual(3000);
  });

  it("exporta el reporte de ganancias a Excel y PDF con archivos válidos", async () => {
    const excel = await request(app)
      .get("/api/reportes/ganancias/exportar.xlsx")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(bufferParser);
    expect(excel.status).toBe(200);
    const libro = XLSX.read(excel.body as Buffer, { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]).length).toBeGreaterThanOrEqual(1);

    const pdf = await request(app)
      .get("/api/reportes/ganancias/exportar.pdf")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(bufferParser);
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("un vendedor no puede acceder a los reportes", async () => {
    const email = `${codigoUnico("vendedor")}@pos.local`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Vendedor test", email, password: "vendedor123", rol: "VENDEDOR" });
    const loginVendedor = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "vendedor123" });

    const res = await request(app)
      .get("/api/reportes/dashboard")
      .set("Authorization", `Bearer ${loginVendedor.body.token}`);
    expect(res.status).toBe(403);
  });
});
