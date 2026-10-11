import mongoose from "mongoose";
import { Document } from "../models/document.model.js";

const getDocumentById = async (documentId) => {
    if (!documentId || !mongoose.isValidObjectId(documentId)) {
        throw new Error("Invalid document ID");
    }

    const document = await Document.findOne({
        _id: documentId,
        isDeleted: false,
    }).lean();

    if (!document) {
        throw new Error("Document not found");
    }

    return document;
};

const updateDocument = async (documentId, updates) => {
    return Document.findOneAndUpdate(
        {
            _id: documentId,
            isDeleted: false,
        },
        {
            $set: updates,
        },
        {
            returnDocument: "after",
            runValidators: true,
        },
    );
};

export { getDocumentById, updateDocument };
