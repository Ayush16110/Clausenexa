import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Contract } from "../models/contract.model.js";

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

const getContracts = asyncHandler(async (req, res) => {
    const contracts = await Contract.find({
        userId: req.user._id,
        isDeleted: false,
    }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(
            new ApiResponse(200, contracts, "Contracts fetched successfully"),
        );
});

const getContractByID = asyncHandler(async (req, res) => {
    const { contractId } = req.params;

    if (!contractId) {
        throw new ApiError(400, "Contract ID is required");
    }

    if (!mongoose.isValidObjectId(contractId)) {
        throw new ApiError(400, "Invalid contract ID");
    }

    const contract = await Contract.findOne({
        _id: contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, contract, "Contract fetched successfully"));
});

const updateContract = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const { title } = req.body;

    if (!contractId) {
        throw new ApiError(400, "Contract id is required");
    }

    if (!mongoose.isValidObjectId(contractId)) {
        throw new ApiError(400, "Invalid contract ID");
    }

    const contract = await Contract.findOne({
        _id: contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    if (title && title != contract.title) {
        contract.title = title;
    }

    const updatedContract = await contract.save();

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedContract, "Title updated successfully"),
        );
});

const deleteContract = asyncHandler(async (req, res) => {
    const { contractId } = req.params;

    if (!contractId) {
        throw new ApiError(400, "Contract id is required");
    }

    if (!mongoose.isValidObjectId(contractId)) {
        throw new ApiError(400, "Invalid contract ID");
    }

    const contract = await Contract.findOne({
        _id: contractId,
        userId: req.user._id,
        isDeleted: false,
    });

    if (!contract) {
        throw new ApiError(404, "Contract not found");
    }

    contract.isDeleted = true;
    contract.deletedAt = new Date();

    await contract.save();

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Contract deleted successfully"));
});

export {
    createContract,
    getContracts,
    getContractByID,
    updateContract,
    deleteContract,
};
