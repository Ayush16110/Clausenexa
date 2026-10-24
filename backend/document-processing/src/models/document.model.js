import mongoose from "mongoose";
import {
    DocumentConversionStateEnum,
    AvailableDocumentConversionState,
    AvailableDocumentProcessingStage,
    AvailableDocumentProcessingStatus,
} from "../utils/document.constants.js";

const documentSchema = new mongoose.Schema(
    {
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        storageKey: {
            type: String,
            required: true,
        },

        fileHash: {
            type: String,
            required: true,
        },

        doclingTaskId: {
            type: String,
            default: null,
        },

        doclingConversionState: {
            type: String,
            default: DocumentConversionStateEnum.PENDING,
            enum: AvailableDocumentConversionState,
        },

        processingStatus: {
            type: String,
            enum: AvailableDocumentProcessingStatus,
            required: true,
        },

        processingStage: {
            type: String,
            enum: AvailableDocumentProcessingStage,
            required: true,
        },

        processingProgress: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },

        processingError: {
            type: String,
            default: null,
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        collection: "documents",
    },
);

const Document = mongoose.model("Document", documentSchema);

export { Document };
