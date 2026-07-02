import { Router } from "express";
import { loginSchema } from "@pos/shared";
import { asyncHandler } from "../../core/middlewares/asyncHandler.js";
import { validate } from "../../core/middlewares/validate.js";
import { loginController } from "./auth.controller.js";

export const authRouter: Router = Router();

authRouter.post("/login", validate(loginSchema), asyncHandler(loginController));
