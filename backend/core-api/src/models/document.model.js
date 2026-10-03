import mongoose from "mongoose";
import {
    AvailableDocumentProcessingStage,
    AvailableDocumentProcessingStatus,
    DocumentProcessingStageEnum,
    DocumentProcessingStatusEnum,
} from "../utils/document.constants.js";

const documentSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            required: true,
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        fileName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },

        mimeType: {
            type: String,
            required: true,
            enum: ["application/pdf"],
        },

        fileSize: {
            type: Number,
            required: true,
            min: 1,
        },

        storageKey: {
            type: String,
            required: true,
            unique: true,
        },

        processingStatus: {
            type: String,
            required: true,
            enum: AvailableDocumentProcessingStatus,
            default: DocumentProcessingStatusEnum.QUEUED,
        },

        processingStage: {
            type: String,
            required: true,
            enum: AvailableDocumentProcessingStage,
            default: DocumentProcessingStageEnum.QUEUED,
        },

        processingProgress: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0,
        },

        processingError: {
            type: String,
            default: null,
        },

        jobId: {
            type: String,
            default: null,
            index: true,
        },

        processingVersion: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
        },

        activeProcessingVersion: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

documentSchema.index({
    contractId: 1,
    isDeleted: 1,
});

documentSchema.index({
    userId: 1,
    isDeleted: 1,
});

export const Document = mongoose.model("Document", documentSchema);
