import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { documentProcessingQueue } from "../queues/document-processing.queue.js";

const createJob = asyncHandler(async (req, res) => {
    const { documentId } = req.body;

    if (!documentId) {
        throw new ApiError(400, "Document ID is required");
    }

    if (!mongoose.isValidObjectId(documentId)) {
        throw new ApiError(400, "Invalid document ID");
    }

    const job = await documentProcessingQueue.add("process-document", {
        documentId,
    });

    return res
        .status(202)
        .json(
            new ApiResponse(202, { jobId: job.id }, "Job queued successfully"),
        );
});

export { createJob };
