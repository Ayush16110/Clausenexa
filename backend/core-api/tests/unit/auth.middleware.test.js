import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

import env from "../../src/config/env.js";
import { ApiError } from "../../src/utils/api-error.js";

jest.unstable_mockModule("../../src/models/user.model.js", () => ({
    User: {
        findById: jest.fn(),
    },
}));

const { User } = await import("../../src/models/user.model.js");
const { verifyJWT } = await import("../../src/middlewares/auth.middleware.js");

describe("verifyJWT Middleware", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            cookies: {},
        };

        res = {};

        next = jest.fn();

        jest.clearAllMocks();
    });

    test("should return unauthorized when access token is missing", async () => {
        await verifyJWT(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        const error = next.mock.calls[0][0];

        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe("Unauthorized access");
    });

    test("should reject when access token is invalid", async () => {
        req.cookies.accessToken = "invalid-token";

        await expect(verifyJWT(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid or expired access token",
        });

        expect(next).not.toHaveBeenCalled();
    });

    test("should authenticate user with a valid access token", async () => {
        const userId = "507f1f77bcf86cd799439011";

        const token = jwt.sign(
            {
                _id: userId,
            },
            env.accessTokenSecret,
            {
                expiresIn: "10m",
            },
        );

        const mockUser = {
            _id: userId,
            username: "testuser",
            email: "test@example.com",
            fullName: "Test User",
            isEmailVerified: true,
        };

        const selectMock = jest.fn().mockResolvedValue(mockUser);

        User.findById.mockReturnValue({
            select: selectMock,
        });

        req.cookies.accessToken = token;

        await verifyJWT(req, res, next);

        expect(User.findById).toHaveBeenCalledWith(userId);

        expect(selectMock).toHaveBeenCalledWith(
            "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry",
        );

        expect(req.user).toEqual(mockUser);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    test("should reject valid token when user does not exist", async () => {
        const userId = "507f1f77bcf86cd799439011";

        const token = jwt.sign(
            {
                _id: userId,
            },
            env.accessTokenSecret,
            {
                expiresIn: "10m",
            },
        );

        const selectMock = jest.fn().mockResolvedValue(null);

        User.findById.mockReturnValue({
            select: selectMock,
        });

        req.cookies.accessToken = token;

        await verifyJWT(req, res, next);

        expect(User.findById).toHaveBeenCalledWith(userId);

        expect(next).toHaveBeenCalledTimes(1);

        const error = next.mock.calls[0][0];

        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe("Invalid access token");
    });
});
