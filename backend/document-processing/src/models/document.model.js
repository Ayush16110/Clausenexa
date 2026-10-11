import mongoose from "mongoose";

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

        processingStatus: {
            type: String,
            enum: ["queued", "processing", "completed", "failed"],
            required: true,
        },

        processingStage: {
            type: String,
            enum: [
                "queued",
                "extracting",
                "chunking",
                "embedding",
                "storing_vectors",
                "completed",
            ],
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
