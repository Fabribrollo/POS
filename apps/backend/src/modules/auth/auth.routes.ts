import { Router } from "express";
import { cambiarPasswordSchema, loginSchema } from "@pos/shared";
import { authGuard } from "../../core/middlewares/authGuard.js";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { loginRateLimit } from "../../core/middlewares/loginRateLimit.js";
import { validate } from "../../core/middlewares/validate.js";
import { cambiarPasswordController, loginController } from "./auth.controller.js";

export const authRouter: Router = Router();

authRouter.post("/login", loginRateLimit, validate(loginSchema), asyncHandler(loginController));
authRouter.post(
  "/cambiar-password",
  authGuard,
  validate(cambiarPasswordSchema),
  asyncHandler(cambiarPasswordController),
);
