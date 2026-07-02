import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { getApp, loginAsAdmin } from "./helpers.js";

async function cerrarSiHayAbierta(app: ReturnType<typeof getApp>, token: string) {
  const abierta = await request(app).get("/api/caja/abierta").set("Authorization", `Bearer ${token}`);
  if (abierta.status === 200) {
    await request(app)
      .post("/api/caja/cerrar")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoCierreDeclarado: 0 });
  }
}

describe("caja", () => {
  const app = getApp();
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    await cerrarSiHayAbierta(app, token);
  });

  it("no permite operar sin una caja abierta", async () => {
    const res = await request(app)
      .post("/api/caja/movimientos")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "INGRESO", monto: 100, concepto: "x" });
    expect(res.status).toBe(404);
  });

  it("abre una caja con el monto declarado", async () => {
    const res = await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 1000 });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("ABIERTA");
  });

  it("no permite abrir una segunda caja mientras la primera sigue abierta", async () => {
    const res = await request(app)
      .post("/api/caja/abrir")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoApertura: 500 });
    expect(res.status).toBe(422);
  });

  it("el arqueo calcula la diferencia correctamente", async () => {
    await request(app)
      .post("/api/caja/movimientos")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "INGRESO", monto: 300, concepto: "ingreso test" });
    await request(app)
      .post("/api/caja/movimientos")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "EGRESO", monto: 100, concepto: "egreso test" });

    // sistema esperado: 1000 + 300 - 100 = 1200; declarado 1150 => diferencia -50
    const res = await request(app)
      .post("/api/caja/cerrar")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoCierreDeclarado: 1150 });

    expect(res.status).toBe(200);
    expect(Number(res.body.montoCierreSistema)).toBe(1200);
    expect(Number(res.body.diferencia)).toBe(-50);
    expect(res.body.estado).toBe("CERRADA");
  });

  it("no permite operar sobre una caja ya cerrada", async () => {
    const res = await request(app)
      .post("/api/caja/movimientos")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "INGRESO", monto: 100, concepto: "x" });
    expect(res.status).toBe(404);
  });
});
