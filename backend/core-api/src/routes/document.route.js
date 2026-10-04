import { Router } from "express";
import {
    createDocument,
    deleteDocument,
    getAllDocuments,
    getDocumentById,
} from "../controllers/document.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { uploadDocument } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);

router
    .route("/contracts/:contractId/documents")
    .post(uploadDocument, createDocument);

router.route("/contracts/:contractId/documents").get(getAllDocuments);

router
    .route("/documents/:documentId")
    .get(getDocumentById)
    .delete(deleteDocument);

export default router;
