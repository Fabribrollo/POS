import "dotenv/config";
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const app = createServer();

app.listen(port, () => {
  console.log(`[backend] escuchando en http://127.0.0.1:${port}`);
});
