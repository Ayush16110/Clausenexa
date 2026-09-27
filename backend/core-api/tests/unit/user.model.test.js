import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import env from "../../src/config/env.js";
import { User } from "../../src/models/user.model.js";

describe("User Model", () => {
    test("should correctly verify a password", async () => {
        const user = new User({
            username: "testuser",
            email: "test@example.com",
            password: await bcrypt.hash("password123", 10),
            fullName: "Test User",
        });

        expect(await user.isPasswordCorrect("password123")).toBe(true);
        expect(await user.isPasswordCorrect("wrongpassword")).toBe(false);
    });

    test("should generate a valid access token", () => {
        const user = new User({
            _id: "507f1f77bcf86cd799439011",
            username: "testuser",
            email: "test@example.com",
            password: "password123",
            fullName: "Test User",
        });

        const token = user.generateAccessToken();

        const decoded = jwt.verify(token, env.accessTokenSecret);

        expect(decoded._id).toBe("507f1f77bcf86cd799439011");
    });

    test("should generate a valid refresh token", () => {
        const user = new User({
            _id: "507f1f77bcf86cd799439011",
            username: "testuser",
            email: "test@example.com",
            password: "password123",
            fullName: "Test User",
        });

        const token = user.generateRefreshToken();

        const decoded = jwt.verify(token, env.refreshTokenSecret);

        expect(decoded._id).toBe("507f1f77bcf86cd799439011");
    });

    test("should generate a valid hashed temporary token", () => {
        const user = new User({
            username: "testuser",
            email: "test@example.com",
            password: "password123",
            fullName: "Test User",
        });

        const { hashedToken, unhashedToken, tokenExpiry } =
            user.generateTemporaryToken();

        const expectedHash = crypto
            .createHash("sha256")
            .update(unhashedToken)
            .digest("hex");

        expect(typeof unhashedToken).toBe("string");
        expect(typeof hashedToken).toBe("string");
        expect(unhashedToken).not.toBe(hashedToken);

        expect(hashedToken).toBe(expectedHash);

        expect(tokenExpiry).toBeInstanceOf(Date);
        expect(tokenExpiry.getTime()).toBeGreaterThan(Date.now());
    });
});
