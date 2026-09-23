import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";

const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, "Core-API service is running"));
});

const readinessCheck = asyncHandler(async (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;

    if (!mongoReady) {
        return res.status(503).json({
            statusCode: 503,
            data: {
                status: "not_ready",
                dependencies: {
                    mongodb: "unavailable",
                },
            },
            message: "Core-API is not ready",
            success: false,
            errors: [],
        });
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
