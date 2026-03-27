import express from "express";
import {
  bootstrapSuperAdmin,
  loginWeb,
  getWebMe,
  createWebUser,
  registerMobile,
  loginMobile,
  getMobileMe,
  logout,
} from "./controller.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import {
  bootstrapSuperAdminSchema,
  createWebUserSchema,
  webLoginSchema,
  mobileRegisterSchema,
  mobileLoginSchema,
} from "./validator.js";

const router = express.Router();

router.post(
  "/bootstrap/super-admin",
  validate(bootstrapSuperAdminSchema),
  bootstrapSuperAdmin
);

router.post("/web/login", validate(webLoginSchema), loginWeb);
router.get("/web/me", protect, getWebMe);
router.post("/web/users", protect, validate(createWebUserSchema), createWebUser);

router.post("/mobile/register", validate(mobileRegisterSchema), registerMobile);
router.post("/mobile/login", validate(mobileLoginSchema), loginMobile);
router.get("/mobile/me", protect, getMobileMe);

router.post("/logout", protect, logout);

export default router;