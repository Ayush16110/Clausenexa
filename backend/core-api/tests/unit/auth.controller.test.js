import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/models/user.model.js", () => ({
    User: {
        findOne: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        create: jest.fn(),
    },
}));

jest.unstable_mockModule("../../src/utils/email.js", () => ({
    sendEmail: jest.fn(),
    emailVerificationMailGenContent: jest.fn(),
    forgotPasswordMailGenContent: jest.fn(),
}));

jest.unstable_mockModule("bcrypt", () => ({
    default: {
        hash: jest.fn(),
        compare: jest.fn(),
    },
}));

jest.unstable_mockModule("crypto", () => ({
    default: {
        createHash: jest.fn(),
    },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
    default: {
        verify: jest.fn(),
    },
}));

jest.unstable_mockModule("../../src/config/env.js", () => ({
    default: {
        clientUrl: "http://localhost:3000",
        nodeEnv: "test",
        accessTokenSecret: "test-access-secret",
        accessTokenExpiry: "10m",
        refreshTokenSecret: "test-refresh-secret",
        refreshTokenExpiry: "10d",
    },
}));

jest.unstable_mockModule("../../src/utils/async-handler.js", () => ({
    asyncHandler: (fn) => fn,
}));

const { User } = await import("../../src/models/user.model.js");

const {
    sendEmail,
    emailVerificationMailGenContent,
    forgotPasswordMailGenContent,
} = await import("../../src/utils/email.js");

const bcrypt = (await import("bcrypt")).default;
const crypto = (await import("crypto")).default;
const jwt = (await import("jsonwebtoken")).default;

const {
    registerUser,
    loginUser,
    verifyEmail,
    refreshAccessToken,
    logout,
    resendEmailVerification,
    forgotPassword,
    resetPassword,
    changePassword,
} = await import("../../src/controllers/auth.controller.js");

function mockHashChain(digestValue) {
    const chain = {};

    chain.update = jest.fn(() => chain);
    chain.digest = jest.fn(() => digestValue);

    return chain;
}

function makeUser(overrides = {}) {
    return {
        _id: "user123",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        isEmailVerified: false,

        refreshToken: null,

        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,

        forgotPasswordToken: null,
        forgotPasswordTokenExpiry: null,

        isPasswordCorrect: jest.fn(),

        generateAccessToken: jest.fn(() => "access-token"),
        generateRefreshToken: jest.fn(() => "refresh-token"),

        generateTemporaryToken: jest.fn(() => ({
            unhashedToken: "unhashed-token",
            hashedToken: "hashed-token",
            tokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        })),

        save: jest.fn().mockResolvedValue(true),

        ...overrides,
    };
}

let req;
let res;
let next;

beforeEach(() => {
    jest.clearAllMocks();

    req = {
        body: {},
        query: {},
        cookies: {},
        user: {},
    };

    res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    bcrypt.hash.mockResolvedValue("hashed-refresh-token");
});

describe("registerUser", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
            username: "testuser",
            password: "password123",
            fullName: "Test User",
        };
    });

    test("should create a user and send verification email", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        User.findById.mockReturnValueOnce({
            select: jest.fn().mockResolvedValue(makeUser()),
        });

        sendEmail.mockResolvedValue(true);

        await registerUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({
            $or: [{ username: "testuser" }, { email: "test@example.com" }],
        });

        expect(User.create).toHaveBeenCalledWith({
            username: "testuser",
            email: "test@example.com",
            password: "password123",
            fullName: "Test User",
        });

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.emailVerificationToken).toBe("hashed-token");
        expect(user.emailVerificationTokenExpiry).toBeInstanceOf(Date);

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(sendEmail).toHaveBeenCalledTimes(1);

        expect(emailVerificationMailGenContent).toHaveBeenCalledWith(
            "testuser",
            expect.stringContaining(
                "/verify-email?token=unhashed-token&id=user123",
            ),
        );

        expect(User.findById).toHaveBeenCalledWith("user123");

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 201,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should reject when user already exists", async () => {
        User.findOne.mockResolvedValue(makeUser());

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 409,
            message: "User with username or email already exists",
        });

        expect(User.create).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    test("should reject when user creation fails", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(null);

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 500,
            message: "Internal server error in user creation",
        });

        expect(sendEmail).not.toHaveBeenCalled();
    });

    test("should reject when verification email fails to send", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("smtp down"));

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 503,
            message:
                "Account created, but verification email could not be sent. Please try again later.",
        });

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(sendEmail).toHaveBeenCalledTimes(1);
    });
});

describe("loginUser", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
            password: "password123",
        };
    });

    test("should log in a verified user with correct password", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findOne.mockResolvedValue(user);

        User.findById.mockResolvedValueOnce(user).mockReturnValueOnce({
            select: jest.fn().mockResolvedValue(
                makeUser({
                    isEmailVerified: true,
                }),
            ),
        });

        await loginUser(req, res, next);

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("password123");

        expect(user.generateAccessToken).toHaveBeenCalledTimes(1);
        expect(user.generateRefreshToken).toHaveBeenCalledTimes(1);

        expect(bcrypt.hash).toHaveBeenCalledWith("refresh-token", 10);

        expect(user.refreshToken).toBe("hashed-refresh-token");

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(res.cookie).toHaveBeenCalledWith(
            "accessToken",
            "access-token",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(next).not.toHaveBeenCalled();
    });

    test("should reject when user does not exist", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject unverified email", async () => {
        User.findOne.mockResolvedValue(
            makeUser({
                isEmailVerified: false,
            }),
        );

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 403,
            message: "Please verify your email before logging in",
        });
    });

    test("should reject incorrect password", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        user.isPasswordCorrect.mockResolvedValue(false);

        User.findOne.mockResolvedValue(user);

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Incorrect Password",
        });
    });
});

describe("verifyEmail", () => {
    beforeEach(() => {
        req.query = {
            id: "user123",
            token: "raw-token",
        };
    });

    test("should reject when id or token is missing", async () => {
        req.query = {};

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Verification token and user ID are required",
        });
    });

    test("should reject when user is not found", async () => {
        User.findById.mockResolvedValue(null);

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject when email is already verified", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                isEmailVerified: true,
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 409,
            message: "User already verified",
        });
    });

    test("should reject when no verification token is stored", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                emailVerificationToken: null,
                emailVerificationTokenExpiry: null,
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid or expired verification token",
        });
    });

    test("should reject an expired verification token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                emailVerificationToken: "hashed",
                emailVerificationTokenExpiry: new Date(Date.now() - 1000),
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Verification token is expired",
        });
    });

    test("should reject a mismatched verification token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                emailVerificationToken: "different-hash",
                emailVerificationTokenExpiry: new Date(Date.now() + 10_000),
            }),
        );

        crypto.createHash.mockReturnValue(mockHashChain("computed-hash"));

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid verification token",
        });
    });

    test("should verify a valid email token", async () => {
        const user = makeUser({
            emailVerificationToken: "matching-hash",
            emailVerificationTokenExpiry: new Date(Date.now() + 10_000),
        });

        User.findById.mockResolvedValue(user);

        crypto.createHash.mockReturnValue(mockHashChain("matching-hash"));

        await verifyEmail(req, res, next);

        expect(user.isEmailVerified).toBe(true);
        expect(user.emailVerificationToken).toBeNull();
        expect(user.emailVerificationTokenExpiry).toBeNull();

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("refreshAccessToken", () => {
    beforeEach(() => {
        req.cookies = {
            refreshToken: "raw-refresh-token",
        };
    });

    test("should reject when refresh token cookie is missing", async () => {
        req.cookies = {};

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Refresh token is missing or invalid",
        });
    });

    test("should reject an invalid refresh JWT", async () => {
        jwt.verify.mockImplementation(() => {
            throw new Error("bad token");
        });

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid or expired refresh token",
        });
    });

    test("should reject when refresh token user is not found", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        User.findById.mockReturnValueOnce({
            select: jest.fn().mockResolvedValue(null),
        });

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid Refresh Token",
        });
    });

    test("should reject when stored refresh token does not match", async () => {
        const user = makeUser({
            refreshToken: "stored-hash",
        });

        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        User.findById.mockReturnValueOnce({
            select: jest.fn().mockResolvedValue(user),
        });

        bcrypt.compare.mockResolvedValue(false);

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Refresh token is invalid",
        });
    });

    test("should issue new tokens for a valid refresh token", async () => {
        const user = makeUser({
            refreshToken: "stored-hash",
        });

        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        User.findById
            .mockReturnValueOnce({
                select: jest.fn().mockResolvedValue(user),
            })
            .mockResolvedValueOnce(user);

        bcrypt.compare.mockResolvedValue(true);

        await refreshAccessToken(req, res, next);

        expect(bcrypt.compare).toHaveBeenCalledWith(
            "raw-refresh-token",
            "stored-hash",
        );

        expect(user.generateAccessToken).toHaveBeenCalledTimes(1);
        expect(user.generateRefreshToken).toHaveBeenCalledTimes(1);

        expect(res.cookie).toHaveBeenCalledWith(
            "accessToken",
            "access-token",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("logout", () => {
    test("should clear refresh token and cookies", async () => {
        req.user = {
            _id: "user123",
        };

        User.findByIdAndUpdate.mockResolvedValue(makeUser());

        await logout(req, res, next);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            "user123",
            {
                $set: {
                    refreshToken: null,
                },
            },
            {
                new: true,
            },
        );

        expect(res.clearCookie).toHaveBeenCalledWith(
            "accessToken",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.clearCookie).toHaveBeenCalledWith(
            "refreshToken",
            expect.objectContaining({
                httpOnly: true,
                secure: false,
            }),
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("resendEmailVerification", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
        };
    });

    test("should reject when user is not found", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject when email is already verified", async () => {
        User.findOne.mockResolvedValue(
            makeUser({
                isEmailVerified: true,
            }),
        );

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 409,
            message: "User is already verified",
        });
    });

    test("should reject when verification email fails to send", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("smtp down"));

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 503,
            message: "Failed to send verification email",
        });

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });
    });

    test("should resend the verification email", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);
        sendEmail.mockResolvedValue(true);

        await resendEmailVerification(req, res, next);

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.emailVerificationToken).toBe("hashed-token");
        expect(user.emailVerificationTokenExpiry).toBeInstanceOf(Date);

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(sendEmail).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("forgotPassword", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
        };
    });

    test("should return success without leaking user existence", async () => {
        User.findOne.mockResolvedValue(null);

        await forgotPassword(req, res, next);

        expect(sendEmail).not.toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                message:
                    "If an account exists with this email, a password reset link has been sent",
            }),
        );
    });

    test("should send a password reset email for an existing user", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);
        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.forgotPasswordToken).toBe("hashed-token");
        expect(user.forgotPasswordTokenExpiry).toBeInstanceOf(Date);
        expect(user.refreshToken).toBeNull();

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(forgotPasswordMailGenContent).toHaveBeenCalledWith(
            "testuser",
            expect.stringContaining(
                "/reset-password?token=unhashed-token&id=user123",
            ),
        );

        expect(sendEmail).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });

    test("should reject when password reset email fails to send", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("smtp down"));

        await expect(forgotPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 503,
            message: "Failed to send password reset email",
        });
    });
});

describe("resetPassword", () => {
    beforeEach(() => {
        req.query = {
            id: "user123",
            token: "raw-token",
        };

        req.body = {
            newPassword: "newPassword123",
        };
    });

    test("should reject when token or id is missing", async () => {
        req.query = {};

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token or Id is missing",
        });
    });

    test("should reject when user is not found", async () => {
        User.findById.mockResolvedValue(null);

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject when no reset token is stored", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                forgotPasswordToken: null,
                forgotPasswordTokenExpiry: null,
            }),
        );

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid or expired token",
        });
    });

    test("should reject an expired reset token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                forgotPasswordToken: "hashed",
                forgotPasswordTokenExpiry: new Date(Date.now() - 1000),
            }),
        );

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token is expired",
        });
    });

    test("should reject a mismatched reset token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                forgotPasswordToken: "different-hash",
                forgotPasswordTokenExpiry: new Date(Date.now() + 10_000),
            }),
        );

        crypto.createHash.mockReturnValue(mockHashChain("computed-hash"));

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token is invalid",
        });
    });

    test("should reset the password with a valid token", async () => {
        const user = makeUser({
            forgotPasswordToken: "matching-hash",
            forgotPasswordTokenExpiry: new Date(Date.now() + 10_000),
        });

        User.findById.mockResolvedValue(user);

        crypto.createHash.mockReturnValue(mockHashChain("matching-hash"));

        await resetPassword(req, res, next);

        expect(user.password).toBe("newPassword123");
        expect(user.refreshToken).toBeNull();
        expect(user.forgotPasswordToken).toBeNull();
        expect(user.forgotPasswordTokenExpiry).toBeNull();

        expect(user.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("changePassword", () => {
    beforeEach(() => {
        req.user = {
            _id: "user123",
        };

        req.body = {
            currentPassword: "oldPass123",
            newPassword: "newPass456",
        };
    });

    test("should reject when user is not found", async () => {
        User.findById.mockResolvedValue(null);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject an incorrect current password", async () => {
        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(false);

        User.findById.mockResolvedValue(user);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Current password is incorrect",
        });

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("oldPass123");
    });

    test("should reject when new password matches current password", async () => {
        req.body.newPassword = "oldPass123";

        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findById.mockResolvedValue(user);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "New password must be different from current password",
        });

        expect(user.save).not.toHaveBeenCalled();
    });

    test("should change the password successfully", async () => {
        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findById.mockResolvedValue(user);

        await changePassword(req, res, next);

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("oldPass123");

        expect(user.password).toBe("newPass456");
        expect(user.refreshToken).toBeNull();

        expect(user.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(next).not.toHaveBeenCalled();
    });
});
