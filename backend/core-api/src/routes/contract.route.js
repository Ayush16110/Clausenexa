import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createContract,
    deleteContract,
    getContractByID,
    getContracts,
    updateContract,
} from "../controllers/contract.controller.js";
import {
    createContractValidator,
    updateContractValidator,
} from "../validators/contract.validator.js";
import { validate } from "../middlewares/validation.middleware.js";

const router = Router();
router.use(verifyJWT);

router
    .route("/")
    .post(createContractValidator(), validate, createContract)
    .get(getContracts);

router
    .route("/:contractId")
    .get(getContractByID)
    .patch(updateContractValidator(), validate, updateContract)
    .delete(deleteContract);
export default router;
