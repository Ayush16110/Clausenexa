import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";

const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, "Core-API service is running"));
});

const readinessCheck = asyncHandler(async (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;

    if (!mongoReady) {
        throw new ApiError(503, "Core-API is not ready", [
            {
                dependency: "mongodb",
                status: "unavailable",
            },
        ]);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                status: "ready",
                dependencies: {
                    mongodb: "available",
                },
            },
            "Core-API is ready",
        ),
    );
});

export { healthCheck, readinessCheck };
