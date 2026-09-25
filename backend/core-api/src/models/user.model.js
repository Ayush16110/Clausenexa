import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import crypto from "crypto";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: [true, "Password is required"],
        },

        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
        },

        isEmailVerified: {
            type: Boolean,
            default: false,
        },

        refreshToken: {
            type: String,
            default: null,
        },

        forgotPasswordToken: {
            type: String,
            default: null,
        },

        forgotPasswordTokenExpiry: {
            type: Date,
            default: null,
        },

        emailVerificationToken: {
            type: String,
            default: null,
        },

        emailVerificationTokenExpiry: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        env.accessTokenSecret,
        { expiresIn: env.accessTokenExpiry },
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        env.refreshTokenSecret,
        { expiresIn: env.refreshTokenExpiry },
    );
};

userSchema.methods.generateTemporaryToken = function () {
    const unhashedToken = crypto.randomBytes(20).toString("hex");

    const hashedToken = crypto
        .createHash("sha256")
        .update(unhashedToken)
        .digest("hex");

    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    return { hashedToken, unhashedToken, tokenExpiry };
};

export const User = mongoose.model("User", userSchema);
