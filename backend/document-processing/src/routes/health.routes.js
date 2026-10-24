import { Router } from "express";
import { getHealth, getReadiness } from "../controllers/health.controller.js";

const router = Router();

router.route("/").get(getHealth);
router.route("/ready").get(getReadiness);

export default router;
