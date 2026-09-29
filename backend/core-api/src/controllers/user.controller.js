import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/async-handler.js";
import env from "../config/env.js";

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
        "-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry",
    );

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User fetched successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
    const { username, fullName } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isUsernameChanging = username && username !== user.username;

    if (
        isUsernameChanging &&
        user.usernameLastChangedAt &&
        new Date() - user.usernameLastChangedAt < 30 * 24 * 60 * 60 * 1000
    ) {
        throw new ApiError(
            429,
            "Username can only be changed once every 30 days",
        );
    }

    if (isUsernameChanging) {
        const existingUserWithUsername = await User.findOne({
            username: username,
            isDeleted: false,
            _id: { $ne: req.user._id },
        });

        if (existingUserWithUsername) {
            throw new ApiError(409, "Username already exists");
        }

        user.username = username;
        user.usernameLastChangedAt = new Date();
    }

    if (fullName) {
        user.fullName = fullName;
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select(
        "-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry",
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "Changes updated and saved successfully",
            ),
        );
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.refreshToken = null;

    await user.save();

    const options = {
        httpOnly: true,
        secure: env.nodeEnv === "production",
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "Account deleted successfully"));
});

export { getCurrentUser, updateUser, deleteUser };
