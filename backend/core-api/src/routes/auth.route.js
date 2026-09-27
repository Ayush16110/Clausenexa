import { Router } from "express";
import {
    userRegisterValidator,
    userLoginValidator,
    resendEmailVerificationValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    changePasswordValidator,
} from "../validators/auth.validator.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
    registerUser,
    loginUser,
    verifyEmail,
    logout,
    refreshAccessToken,
    resendEmailVerification,
    forgotPassword,
    resetPassword,
    changePassword,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// unsecured routes
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, loginUser);
router.route("/verify-email").get(verifyEmail);
router.route("/refresh").post(refreshAccessToken);
router
    .route("/resend-verification")
    .post(
        resendEmailVerificationValidator(),
        validate,
        resendEmailVerification,
    );
router
    .route("/forgot-password")
    .post(forgotPasswordValidator(), validate, forgotPassword);
router
    .route("/reset-password")
    .post(resetPasswordValidator(), validate, resetPassword);

// secured routes
router.route("/logout").post(verifyJWT, logout);
router
    .route("/change-password")
    .post(verifyJWT, changePasswordValidator(), validate, changePassword);

export default router;
