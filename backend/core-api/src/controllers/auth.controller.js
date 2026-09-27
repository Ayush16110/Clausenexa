import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
    sendEmail,
    emailVerificationMailGenContent,
    forgotPasswordMailGenContent,
} from "../utils/email.js";
import env from "../config/env.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    user.refreshToken = hashedRefreshToken;

    await user.save({
        validateBeforeSave: false,
    });

    return {
        accessToken,
        refreshToken,
    };
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, username, password, fullName } = req.body;

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with username or email already exists");
    }

    const user = await User.create({
        username: username,
        email: email,
        password: password,
        fullName: fullName,
    });

    if (!user) {
        throw new ApiError(500, "Internal server error in user creation");
    }

    const { unhashedToken, hashedToken, tokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    const verificationLink = `${env.clientUrl}/verify-email?token=${unhashedToken}&id=${user._id}`;

    try {
        await sendEmail({
            email: user.email,
            subject: "User Account Verification",
            mailGenContent: emailVerificationMailGenContent(
                user.username,
                verificationLink,
            ),
        });
    } catch (error) {
        throw new ApiError(
            503,
            "Account created, but verification email could not be sent. Please try again later.",
        );
    }

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry ",
    );

    if (!createdUser) {
        throw new ApiError(500, "Internal server error");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, createdUser, "Successfully created User"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({
        email: email,
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.isEmailVerified) {
        throw new ApiError(403, "Please verify your email before logging in");
    }
    const passwordCheck = await user.isPasswordCorrect(password);

    if (!passwordCheck) {
        throw new ApiError(401, "Incorrect Password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id,
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry ",
    );

    const options = {
        httpOnly: true,
        secure: env.nodeEnv === "production",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, loggedInUser, "User successfully logged in"),
        );
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { id, token } = req.query;

    if (!id || !token) {
        throw new ApiError(400, "Verification token and user ID are required");
    }

    const user = await User.findById(id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isEmailVerified) {
        throw new ApiError(409, "User already verified");
    }

    if (!user.emailVerificationToken || !user.emailVerificationTokenExpiry) {
        throw new ApiError(400, "Invalid or expired verification token");
    }

    if (user.emailVerificationTokenExpiry < new Date()) {
        throw new ApiError(400, "Verification token is expired");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    if (hashedToken !== user.emailVerificationToken) {
        throw new ApiError(400, "Invalid verification token");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;

    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Email verified Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;

    if (!token) {
        throw new ApiError(401, "Refresh token is missing or invalid");
    }

    let decodedToken;

    try {
        decodedToken = jwt.verify(token, env.refreshTokenSecret);
    } catch (error) {
        throw new ApiError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(decodedToken?._id).select(
        "-password -emailVerificationToken -emailVerificationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry ",
    );

    if (!user) {
        throw new ApiError(401, "Invalid Refresh Token");
    }

    const isTokenValid = await bcrypt.compare(token, user.refreshToken);

    if (!isTokenValid) {
        throw new ApiError(401, "Refresh token is invalid");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id,
    );

    const options = {
        httpOnly: true,
        secure: env.nodeEnv === "production",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                null,
                "New acccess and refresh tokens are generated successfuly",
            ),
        );
});

const logout = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null,
            },
        },
        {
            new: true,
        },
    );

    const options = {
        httpOnly: true,
        secure: env.nodeEnv === "production",
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "User successfully logged out"));
});

const resendEmailVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({
        email: email,
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isEmailVerified) {
        throw new ApiError(409, "User is already verified");
    }

    const { unhashedToken, hashedToken, tokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    const verificationLink = `${env.clientUrl}/verify-email?token=${unhashedToken}&id=${user._id}`;

    try {
        await sendEmail({
            email: user.email,
            subject: "User Account Verification",
            mailGenContent: emailVerificationMailGenContent(
                user.username,
                verificationLink,
            ),
        });
    } catch (error) {
        throw new ApiError(503, "Failed to send verification email");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Verification email sent"));
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({
        email: email,
    });

    if (!user) {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    null,
                    "If an account exists with this email, a password reset link has been sent",
                ),
            );
    }

    const { unhashedToken, hashedToken, tokenExpiry } =
        user.generateTemporaryToken();

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordTokenExpiry = tokenExpiry;
    user.refreshToken = null;

    await user.save({
        validateBeforeSave: false,
    });

    const resetLink = `${env.clientUrl}/reset-password?token=${unhashedToken}&id=${user._id}`;

    try {
        await sendEmail({
            email: email,
            subject: "Reset Your ClauseNexa Password",
            mailGenContent: forgotPasswordMailGenContent(
                user.username,
                resetLink,
            ),
        });
    } catch (error) {
        throw new ApiError(503, "Failed to send password reset email");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "If an account exists with this email, a password reset link has been sent",
            ),
        );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, id } = req.query;
    const { newPassword } = req.body;

    if (!token || !id) {
        throw new ApiError(400, "Token or Id is missing");
    }

    const user = await User.findById(id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.forgotPasswordToken || !user.forgotPasswordTokenExpiry) {
        throw new ApiError(400, "Invalid or expired token");
    }

    if (user.forgotPasswordTokenExpiry < new Date()) {
        throw new ApiError(400, "Token is expired");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const isTokenValid = hashedToken === user.forgotPasswordToken;

    if (!isTokenValid) {
        throw new ApiError(400, "Token is invalid");
    }

    user.password = newPassword;
    user.refreshToken = null;
    user.forgotPasswordToken = null;
    user.forgotPasswordTokenExpiry = null;
    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successful"));
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isCurrentPassValid = await user.isPasswordCorrect(currentPassword);

    if (!isCurrentPassValid) {
        throw new ApiError(401, "Current password is incorrect");
    }

    if (currentPassword === newPassword) {
        throw new ApiError(
            400,
            "New password must be different from current password",
        );
    }

    user.password = newPassword;
    user.refreshToken = null;

    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Password changed successfully"));
});

export {
    registerUser,
    loginUser,
    verifyEmail,
    logout,
    refreshAccessToken,
    resendEmailVerification,
    forgotPassword,
    resetPassword,
    changePassword,
};
