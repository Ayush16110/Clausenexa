import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { checkR2Health } from "../services/r2.service.js";
import { checkDocumentProcessingHealth } from "../services/document-processing.service.js";

const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, "Core-API service is running"));
});

const readinessCheck = asyncHandler(async (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;

    const [r2Ready, documentProcessingReady] = await Promise.all([
        checkR2Health(),
        checkDocumentProcessingHealth(),
    ]);

    const dependencies = {
        mongodb: mongoReady ? "available" : "unavailable",
        r2: r2Ready ? "available" : "unavailable",
        documentProcessing: documentProcessingReady
            ? "available"
            : "unavailable",
    };

    if (!mongoReady || !r2Ready || !documentProcessingReady) {
        throw new ApiError(503, "Core-API is not ready", [
            ...(!mongoReady
                ? [
                      {
                          dependency: "mongodb",
                          status: "unavailable",
                      },
                  ]
                : []),
            ...(!r2Ready
                ? [
                      {
                          dependency: "r2",
                          status: "unavailable",
                      },
                  ]
                : []),
            ...(!documentProcessingReady
                ? [
                      {
                          dependency: "document-processing",
                          status: "unavailable",
                      },
                  ]
                : []),
        ]);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                status: "ready",
                dependencies,
            },
            "Core-API is ready",
        ),
    );
});

export { healthCheck, readinessCheck };
