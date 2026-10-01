import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Contract } from "../models/contract.model.js";
import mongoose from "mongoose";

const createContract = asyncHandler(async (req, res) => {
    const { title } = req.body;

    const contract = await Contract.create({
        title,
        userId: req.user._id,
    });

    if (!contract) {
        throw new ApiError(500, "Failed to create contract");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, contract, "Contract created successfully"));
});

export { createContract };
