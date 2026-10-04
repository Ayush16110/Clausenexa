import mongoose from "mongoose";
import { Contract } from "../models/contract.model.js";
import { Document } from "../models/document.model.js";
import { uploadToR2, deleteFromR2 } from "../services/r2.service.js";
import { createProcessingJob } from "../services/document-processing.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { generateDocumentStorageKey } from "../utils/storage.utils.js";
import { generateFileHash } from "../utils/hash.utils.js";

const createDocument = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const file = req.file;

    if (!mongoose.isValidObjectId(contractId)) {
        throw new ApiError(400, "Invalid contract ID");
    }

    if (!file) {
        throw new ApiError(400, "Document file is required");
    }

    const contract = await Contract.findOne({
        _id: contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    const fileHash = generateFileHash(file.buffer);

    const existingDocument = await Document.findOne({
        contractId,
        fileHash,
        isDeleted: false,
    });

    if (existingDocument) {
        throw new ApiError(
            409,
            "This document has already been uploaded to this contract",
        );
    }

    const document = new Document({
        contractId,
        userId: req.user._id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
    });

    const storageKey = generateDocumentStorageKey(contractId, document._id);

    try {
        await uploadToR2({
            buffer: file.buffer,
            storageKey,
            mimeType: file.mimetype,
        });

        document.storageKey = storageKey;

        await document.save();

        const { jobId } = await createProcessingJob(document._id);

        document.jobId = jobId;

        await document.save();

        return res.status(202).json(
            new ApiResponse(
                202,
                {
                    documentId: document._id,
                    jobId: document.jobId,
                    processingStatus: document.processingStatus,
                },
                "Document uploaded and processing started",
            ),
        );
    } catch (error) {
        if (document.isNew === false) {
            await Document.deleteOne({
                _id: document._id,
            }).catch((cleanupError) => {
                console.error(
                    "Failed to cleanup document metadata:",
                    cleanupError,
                );
            });
        }

        try {
            await deleteFromR2(storageKey);
        } catch (cleanupError) {
            console.error("Failed to cleanup R2 object:", cleanupError);
        }

        throw error;
    }
});

const getAllDocuments = asyncHandler(async (req, res) => {
    const { contractId } = req.params;

    if (!mongoose.isValidObjectId(contractId)) {
        throw new ApiError(400, "Invalid contract ID");
    }

    const contract = await Contract.findOne({
        _id: contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    const documents = await Document.find({
        contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, documents, "Documents fetched successfully"),
        );
});

const getDocumentById = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!mongoose.isValidObjectId(documentId)) {
        throw new ApiError(400, "Invalid document ID");
    }

    const document = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, document, "Document fetched successfully"));
});

const deleteDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!mongoose.isValidObjectId(documentId)) {
        throw new ApiError(400, "Invalid document ID");
    }

    const document = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const contract = await Contract.findOne({
        _id: document.contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    if (
        contract.activeDocumentId &&
        contract.activeDocumentId.equals(document._id)
    ) {
        contract.activeDocumentId = null;
        await contract.save();
    }

    document.isDeleted = true;
    document.deletedAt = new Date();

    await document.save();

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Document deleted successfully"));
});

export { createDocument, getAllDocuments, getDocumentById, deleteDocument };
