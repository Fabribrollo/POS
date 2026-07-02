import request from "supertest";
import { createServer } from "../src/index.js";

export function getApp() {
  return createServer();
}

export async function loginAsAdmin(app: ReturnType<typeof getApp>): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@pos.local", password: "admin123" });
  return res.body.token as string;
}

let contador = 0;
// Códigos únicos por test para no chocar con la unicidad de codigoInterno
// entre archivos de test que comparten la misma DB.
export function codigoUnico(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${Date.now()}-${contador}`;
}
