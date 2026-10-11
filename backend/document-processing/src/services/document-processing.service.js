import mongoose from "mongoose";
import { getDocumentById, updateDocument } from "./document.service.js";
import {
    DocumentProcessingStageEnum,
    DocumentProcessingStatusEnum,
} from "../utils/document.constants.js";
import { downloadDocument } from "./storage.service.js";

const processDocument = async (documentId) => {
    if (!documentId) {
        throw new Error("Document ID is required");
    }

    if (!mongoose.isValidObjectId(documentId)) {
        throw new Error("Invalid document ID");
    }

    const document = await getDocumentById(documentId);

    console.log(`Starting processing for document: ${document._id}`);
    console.log(`Storage key: ${document.storageKey}`);

    const pdfBuffer = await downloadDocument(document.storageKey);

    console.log(`Downloaded PDF: ${document.fileName}`);
    console.log(`Downloaded size: ${pdfBuffer.length} bytes`);

    const updatedDocument = await updateDocument(documentId, {
        processingStatus: DocumentProcessingStatusEnum.PROCESSING,
        processingStage: DocumentProcessingStageEnum.EXTRACTING,
        processingProgress: 0,
        processingError: null,
    });

    if (!updatedDocument) {
        throw new Error("Document not found or has been deleted");
    }

    // FIXME: Extract and clean PDF text
    // FIXME: Split text into chunks
    // FIXME: Generate embeddings
    // FIXME: Store vectors

    return {
        documentId,
        status: "completed",
    };
};

export { processDocument };
