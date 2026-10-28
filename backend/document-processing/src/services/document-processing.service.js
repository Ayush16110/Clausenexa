import mongoose from "mongoose";
import { getDocumentById, updateDocument } from "./document.service.js";
import {
    DocumentProcessingStageEnum,
    DocumentProcessingStatusEnum,
} from "../utils/document.constants.js";
import { downloadDocument } from "./storage.service.js";
import { validatePdfBuffer } from "../utils/pdf.utils.js";
import { UnrecoverableError } from "bullmq";
import { extractMarkdownFromPdf } from "./docling.service.js";
import { cleanMarkdown } from "../utils/markdown.utils.js";

const processDocument = async (documentId) => {
    // basic validation
    if (!documentId) {
        throw new Error("Document ID is required");
    }

    if (!mongoose.isValidObjectId(documentId)) {
        throw new Error("Invalid document ID");
    }

    // get document
    const document = await getDocumentById(documentId);

    console.log(`Starting processing for document: ${document._id}`);
    console.log(`Storage key: ${document.storageKey}`);

    // pdf download
    const pdfBuffer = await downloadDocument(document.storageKey);

    console.log(`Downloaded PDF: ${document.fileName}`);
    console.log(`Downloaded size: ${pdfBuffer.length} bytes`);

    // pdf validation
    try {
        validatePdfBuffer(pdfBuffer);
    } catch (error) {
        console.error("PDF validation failed:", error.message);
        throw new UnrecoverableError(error.message);
    }

    // update document
    let updatedDocument = await updateDocument(documentId, {
        processingStatus: DocumentProcessingStatusEnum.PROCESSING,
        processingStage: DocumentProcessingStageEnum.EXTRACTING,
        processingProgress: 0,
        processingError: null,
    });

    if (!updatedDocument) {
        throw new Error("Document not found or has been deleted");
    }

    // Convert PDF to md
    const markdown = await extractMarkdownFromPdf(
        updatedDocument,
        pdfBuffer,
        document.fileName,
    );

    // Clean extracted Markdown
    const cleanedMarkdown = cleanMarkdown(markdown);

    updatedDocument = await updateDocument(documentId, {
        processingStage: DocumentProcessingStageEnum.CHUNKING,
        processingProgress: 25,
    });

    // FIXME: Split text into chunks
    // FIXME: Generate embeddings
    // FIXME: Store vectors

    // Mark extraction workflow as completed
    const completedDocument = await updateDocument(documentId, {
        processingStatus: DocumentProcessingStatusEnum.COMPLETED,
        processingProgress: 100,
        processingError: null,
    });

    if (!completedDocument) {
        throw new Error("Failed to mark document processing as completed");
    }

    return {
        documentId,
        status: "completed",
    };
};

export { processDocument };
