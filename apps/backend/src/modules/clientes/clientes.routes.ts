import { Router } from "express";
import {
  actualizarClienteSchema,
  crearClienteSchema,
  movimientoCuentaCorrienteSchema,
} from "@pos/shared";
import { authGuard, roleGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import {
  actualizarController,
  buscarController,
  crearController,
  desactivarController,
  historialComprasController,
  listarController,
  movimientosCCController,
  registrarMovimientoCCController,
  saldoCCController,
} from "./clientes.controller.js";

export const clientesRouter: Router = Router();

clientesRouter.use(authGuard);

const leer = roleGuard("CLIENTES_LEER");
const escribir = roleGuard("CLIENTES_ESCRIBIR");
const cuentaCorriente = roleGuard("CLIENTES_CUENTA_CORRIENTE");

clientesRouter.get("/", leer, asyncHandler(listarController));
clientesRouter.get("/:id", leer, asyncHandler(buscarController));
clientesRouter.post("/", escribir, validate(crearClienteSchema), asyncHandler(crearController));
clientesRouter.patch(
  "/:id",
  escribir,
  validate(actualizarClienteSchema),
  asyncHandler(actualizarController),
);
clientesRouter.delete("/:id", escribir, asyncHandler(desactivarController));
clientesRouter.get("/:id/compras", leer, asyncHandler(historialComprasController));

clientesRouter.get("/:id/cuenta-corriente/saldo", cuentaCorriente, asyncHandler(saldoCCController));
clientesRouter.get(
  "/:id/cuenta-corriente/movimientos",
  cuentaCorriente,
  asyncHandler(movimientosCCController),
);
clientesRouter.post(
  "/:id/cuenta-corriente/movimientos",
  cuentaCorriente,
  validate(movimientoCuentaCorrienteSchema),
  asyncHandler(registrarMovimientoCCController),
);
