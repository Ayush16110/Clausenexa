import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        activeDocumentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            default: null,
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

contractSchema.index({
    userId: 1,
    isDeleted: 1,
});

export const Contract = mongoose.model("Contract", contractSchema);
