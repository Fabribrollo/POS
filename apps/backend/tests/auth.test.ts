import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp, loginAsAdmin } from "./helpers.js";

describe("auth", () => {
  const app = getApp();

  it("rechaza credenciales inválidas", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@pos.local", password: "incorrecta" });
    expect(res.status).toBe(401);
  });

  it("permite login con las credenciales del seed", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@pos.local", password: "admin123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.usuario.rol).toBe("ADMINISTRADOR");
  });

  it("rechaza un endpoint protegido sin token", async () => {
    const res = await request(app).get("/api/usuarios");
    expect(res.status).toBe(401);
  });

  it("rechaza un token inválido", async () => {
    const res = await request(app)
      .get("/api/usuarios")
      .set("Authorization", "Bearer token-invalido");
    expect(res.status).toBe(401);
  });

  it("bloquea a un vendedor de un endpoint solo-admin (403)", async () => {
    const token = await loginAsAdmin(app);
    const nuevo = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nombre: "Vendedor Auth Test",
        email: `vendedor.auth.${Date.now()}@pos.local`,
        password: "vendedor123",
        rol: "VENDEDOR",
      });
    expect(nuevo.status).toBe(201);

    const loginVendedor = await request(app)
      .post("/api/auth/login")
      .send({ email: nuevo.body.email, password: "vendedor123" });
    const vendedorToken = loginVendedor.body.token as string;

    const res = await request(app)
      .get("/api/usuarios")
      .set("Authorization", `Bearer ${vendedorToken}`);
    expect(res.status).toBe(403);
  });
});
