import { Router } from "express";
import {
    healthCheck,
    readinessCheck,
} from "../controllers/healthCheck.controller.js";

const router = Router();

router.route("/").get(healthCheck);
router.route("/ready").get(readinessCheck);

export default router;
