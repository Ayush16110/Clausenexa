import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    getCurrentUser,
    updateUser,
    deleteUser,
} from "../controllers/user.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import { updateUserValidator } from "../validators/user.validator.js";

const router = Router();

router.use(verifyJWT);

router
    .route("/me")
    .get(getCurrentUser)
    .patch(updateUserValidator(), validate, updateUser)
    .delete(deleteUser);

export default router;
