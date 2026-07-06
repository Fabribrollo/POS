import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp, loginAsAdmin } from "./helpers.js";

describe("negocio", () => {
  const app = getApp();

  it("requiere sesión", async () => {
    const res = await request(app).get("/api/negocio");
    expect(res.status).toBe(401);
  });

  it("devuelve los datos del negocio para imprimir en el ticket", async () => {
    const token = await loginAsAdmin(app);
    const res = await request(app).get("/api/negocio").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nombre");
    expect(res.body).toHaveProperty("direccion");
    expect(res.body).toHaveProperty("cuit");
  });
});
