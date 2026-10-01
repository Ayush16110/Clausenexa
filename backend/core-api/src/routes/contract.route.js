import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createContract } from "../controllers/contract.controller.js";
import { createContractValidator } from "../validators/contract.validator.js";
import { validate } from "../middlewares/validation.middleware.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(createContractValidator(), validate, createContract);

export default router;
