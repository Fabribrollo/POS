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

  it("permite login con las credenciales del seed y avisa que debe cambiar la contraseña", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@pos.local", password: "admin123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.usuario.rol).toBe("ADMINISTRADOR");
    expect(res.body.debeCambiarPassword).toBe(true);
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

  it("permite a un usuario cambiar su propia contraseña y desactiva el flag de cambio obligatorio", async () => {
    const token = await loginAsAdmin(app);
    const email = `cambio-password-${Date.now()}@pos.local`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Usuario cambio password", email, password: "vieja123", rol: "VENDEDOR" });

    const loginViejo = await request(app).post("/api/auth/login").send({ email, password: "vieja123" });
    expect(loginViejo.body.debeCambiarPassword).toBe(false); // solo el admin sembrado arranca en true
    const tokenUsuario = loginViejo.body.token as string;

    const cambio = await request(app)
      .post("/api/auth/cambiar-password")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .send({ passwordActual: "vieja123", passwordNueva: "nueva456" });
    expect(cambio.status).toBe(204);

    const loginConViejaFalla = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "vieja123" });
    expect(loginConViejaFalla.status).toBe(401);

    const loginConNuevaFunciona = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "nueva456" });
    expect(loginConNuevaFunciona.status).toBe(200);
  });

  it("rechaza el cambio de contraseña si la contraseña actual está mal", async () => {
    const token = await loginAsAdmin(app);
    const email = `cambio-password-mal-${Date.now()}@pos.local`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Usuario cambio password mal", email, password: "correcta123", rol: "VENDEDOR" });

    const login = await request(app).post("/api/auth/login").send({ email, password: "correcta123" });
    const tokenUsuario = login.body.token as string;

    const cambio = await request(app)
      .post("/api/auth/cambiar-password")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .send({ passwordActual: "incorrecta", passwordNueva: "nueva456" });
    expect(cambio.status).toBe(422);
  });

  describe("rate limit de login", () => {
    it("bloquea con 429 después de 5 intentos fallidos contra la misma cuenta", async () => {
      const email = `fuerza-bruta-${Date.now()}@pos.local`;

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email, password: "cualquiera" });
        expect(res.status).toBe(401);
      }

      const sexto = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "cualquiera" });
      expect(sexto.status).toBe(429);
    });

    it("el límite es por cuenta: agotarlo en un email no bloquea a otro", async () => {
      const emailBloqueado = `fuerza-bruta-b-${Date.now()}@pos.local`;
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/login").send({ email: emailBloqueado, password: "x" });
      }
      const bloqueado = await request(app)
        .post("/api/auth/login")
        .send({ email: emailBloqueado, password: "x" });
      expect(bloqueado.status).toBe(429);

      // admin@pos.local no comparte el contador con emailBloqueado.
      const otraCuenta = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@pos.local", password: "admin123" });
      expect(otraCuenta.status).toBe(200);
    });

    it("los logins exitosos no cuentan para el límite", async () => {
      const email = `login-repetido-${Date.now()}@pos.local`;
      const token = await loginAsAdmin(app);
      await request(app)
        .post("/api/usuarios")
        .set("Authorization", `Bearer ${token}`)
        .send({ nombre: "Login repetido", email, password: "correcta123", rol: "VENDEDOR" });

      for (let i = 0; i < 7; i++) {
        const res = await request(app).post("/api/auth/login").send({ email, password: "correcta123" });
        expect(res.status).toBe(200);
      }
    });
  });
});
