// dotenv/config solo lee el .env del cwd (apps/backend); el .env real del
// monorepo vive en la raíz, así que se carga explícitamente por ruta.
import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
config();
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const app = createServer();

app.listen(port, () => {
  console.log(`[backend] escuchando en http://127.0.0.1:${port}`);
});
