import { Router } from "express";
import {
    userRegisterValidator,
    userLoginValidator,
} from "../validators/auth.validator.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
    registerUser,
    loginUser,
    verifyEmail,
    logout,
    refreshAccessToken,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// unsecured routes
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, loginUser);
router.route("/verify-email").get(verifyEmail);
router.route("/refresh").post(refreshAccessToken);

// secured routes
router.route("/logout").post(verifyJWT, logout);

export default router;
