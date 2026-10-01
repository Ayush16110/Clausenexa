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

        isDeleted: false,
        deletedAt: null,

        refreshToken: null,

        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,

        forgotPasswordToken: null,
        forgotPasswordTokenExpiry: null,

        password: "hashed-password",

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

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
    };
}

function mockUserSelect(user) {
    return {
        select: jest.fn().mockResolvedValue(user),
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

    res = makeResponse();

    next = jest.fn();

    bcrypt.hash.mockResolvedValue("hashed-refresh-token");

    emailVerificationMailGenContent.mockReturnValue(
        "<html>verification email</html>",
    );

    forgotPasswordMailGenContent.mockReturnValue(
        "<html>password reset email</html>",
    );
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

    test("should register a new user successfully", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        User.findById.mockReturnValue(
            mockUserSelect(
                makeUser({
                    isEmailVerified: false,
                }),
            ),
        );

        sendEmail.mockResolvedValue(true);

        await registerUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({
            $or: [
                {
                    username: "testuser",
                },
                {
                    email: "test@example.com",
                },
            ],
            isDeleted: false,
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

        expect(emailVerificationMailGenContent).toHaveBeenCalledWith(
            "testuser",
            expect.stringContaining(
                "/verify-email?token=unhashed-token&id=user123",
            ),
        );

        expect(sendEmail).toHaveBeenCalledWith({
            email: "test@example.com",
            subject: "User Account Verification",
            mailGenContent: "<html>verification email</html>",
        });

        expect(User.findById).toHaveBeenCalledWith("user123");

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 201,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should reject an already existing active user", async () => {
        User.findOne.mockResolvedValue(
            makeUser({
                isDeleted: false,
            }),
        );

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 409,
            message: "User with username or email already exists",
        });

        expect(User.create).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    test("should allow registration when only deleted matching user exists", async () => {
        User.findOne.mockResolvedValue(null);

        const user = makeUser();

        User.create.mockResolvedValue(user);

        User.findById.mockReturnValue(mockUserSelect(makeUser()));

        sendEmail.mockResolvedValue(true);

        await registerUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({
            $or: [
                {
                    username: "testuser",
                },
                {
                    email: "test@example.com",
                },
            ],
            isDeleted: false,
        });

        expect(User.create).toHaveBeenCalled();
    });

    test("should reject when user creation returns null", async () => {
        User.findOne.mockResolvedValue(null);

        User.create.mockResolvedValue(null);

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 500,
            message: "Internal server error in user creation",
        });

        expect(sendEmail).not.toHaveBeenCalled();
    });

    test("should generate and store email verification token", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        User.findById.mockReturnValue(mockUserSelect(makeUser()));

        sendEmail.mockResolvedValue(true);

        await registerUser(req, res, next);

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.emailVerificationToken).toBe("hashed-token");

        expect(user.emailVerificationTokenExpiry).toBeInstanceOf(Date);
    });

    test("should send verification email with correct link", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        User.findById.mockReturnValue(mockUserSelect(makeUser()));

        sendEmail.mockResolvedValue(true);

        await registerUser(req, res, next);

        expect(emailVerificationMailGenContent).toHaveBeenCalledWith(
            "testuser",
            "http://localhost:3000/verify-email?token=unhashed-token&id=user123",
        );
    });

    test("should return 503 when verification email fails", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("SMTP server unavailable"));

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 503,
            message:
                "Account created, but verification email could not be sent. Please try again later.",
        });

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });
    });

    test("should reject when created user cannot be fetched", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        User.findById.mockReturnValue(mockUserSelect(null));

        await expect(registerUser(req, res, next)).rejects.toMatchObject({
            statusCode: 500,
            message: "Internal server error",
        });
    });
});

describe("loginUser", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
            password: "password123",
        };
    });

    test("should login a verified user successfully", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        const loggedInUser = makeUser({
            isEmailVerified: true,
        });

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findOne.mockResolvedValue(user);

        User.findById
            .mockResolvedValueOnce(user)
            .mockReturnValueOnce(mockUserSelect(loggedInUser));

        await loginUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({
            email: "test@example.com",
            isDeleted: false,
        });

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("password123");

        expect(user.generateAccessToken).toHaveBeenCalledTimes(1);

        expect(user.generateRefreshToken).toHaveBeenCalledTimes(1);

        expect(bcrypt.hash).toHaveBeenCalledWith("refresh-token", 10);

        expect(user.refreshToken).toBe("hashed-refresh-token");

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(res.cookie).toHaveBeenCalledWith("accessToken", "access-token", {
            httpOnly: true,
            secure: false,
        });

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token",
            {
                httpOnly: true,
                secure: false,
            },
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
            }),
        );
    });

    test("should reject non-existent user", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });

        expect(userNotUsed(User));
    });

    test("should reject deleted user", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });

        expect(User.findOne).toHaveBeenCalledWith({
            email: "test@example.com",
            isDeleted: false,
        });
    });

    test("should reject unverified email", async () => {
        const user = makeUser({
            isEmailVerified: false,
        });

        User.findOne.mockResolvedValue(user);

        await expect(loginUser(req, res, next)).rejects.toMatchObject({
            statusCode: 403,
            message: "Please verify your email before logging in",
        });

        expect(user.isPasswordCorrect).not.toHaveBeenCalled();
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

        expect(user.generateAccessToken).not.toHaveBeenCalled();
        expect(user.generateRefreshToken).not.toHaveBeenCalled();
    });

    test("should not issue cookies when password is incorrect", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        user.isPasswordCorrect.mockResolvedValue(false);

        User.findOne.mockResolvedValue(user);

        await expect(loginUser(req, res, next)).rejects.toBeDefined();

        expect(res.cookie).not.toHaveBeenCalled();
    });

    test("should fetch sanitized logged-in user", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findOne.mockResolvedValue(user);

        const select = jest.fn().mockResolvedValue(
            makeUser({
                isEmailVerified: true,
            }),
        );

        User.findById.mockResolvedValueOnce(user).mockReturnValueOnce({
            select,
        });

        await loginUser(req, res, next);

        expect(select).toHaveBeenCalledWith(
            expect.stringContaining("-password"),
        );

        expect(select).toHaveBeenCalledWith(
            expect.stringContaining("-refreshToken"),
        );
    });
});

describe("verifyEmail", () => {
    beforeEach(() => {
        req.query = {
            id: "user123",
            token: "raw-token",
        };
    });

    test("should reject when id is missing", async () => {
        req.query.id = undefined;

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Verification token and user ID are required",
        });

        expect(User.findById).not.toHaveBeenCalled();
    });

    test("should reject when token is missing", async () => {
        req.query.token = undefined;

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Verification token and user ID are required",
        });
    });

    test("should reject when user does not exist", async () => {
        User.findById.mockResolvedValue(null);

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject deleted user", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                isDeleted: true,
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject already verified user", async () => {
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

    test("should reject missing verification token", async () => {
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

    test("should reject missing verification token expiry", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                emailVerificationToken: "hashed-token",
                emailVerificationTokenExpiry: null,
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid or expired verification token",
        });
    });

    test("should reject expired verification token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                emailVerificationToken: "hashed-token",
                emailVerificationTokenExpiry: new Date(Date.now() - 1000),
            }),
        );

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Verification token is expired",
        });
    });

    test("should reject invalid verification token", async () => {
        const user = makeUser({
            emailVerificationToken: "different-hash",
            emailVerificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        });

        User.findById.mockResolvedValue(user);

        crypto.createHash.mockReturnValue(mockHashChain("computed-hash"));

        await expect(verifyEmail(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid verification token",
        });

        expect(crypto.createHash).toHaveBeenCalledWith("sha256");
    });

    test("should verify a valid email token", async () => {
        const user = makeUser({
            emailVerificationToken: "matching-hash",
            emailVerificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        });

        User.findById.mockResolvedValue(user);

        const hashChain = mockHashChain("matching-hash");

        crypto.createHash.mockReturnValue(hashChain);

        await verifyEmail(req, res, next);

        expect(hashChain.update).toHaveBeenCalledWith("raw-token");

        expect(hashChain.digest).toHaveBeenCalledWith("hex");

        expect(user.isEmailVerified).toBe(true);

        expect(user.emailVerificationToken).toBeNull();

        expect(user.emailVerificationTokenExpiry).toBeNull();

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("refreshAccessToken", () => {
    beforeEach(() => {
        req.cookies = {
            refreshToken: "raw-refresh-token",
        };
    });

    test("should reject missing refresh token", async () => {
        req.cookies = {};

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Refresh token is missing or invalid",
        });

        expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("should reject invalid JWT", async () => {
        jwt.verify.mockImplementation(() => {
            throw new Error("invalid jwt");
        });

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid or expired refresh token",
        });
    });

    test("should verify refresh token with correct secret", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        User.findById.mockReturnValue(mockUserSelect(null));

        await expect(refreshAccessToken(req, res, next)).rejects.toBeDefined();

        expect(jwt.verify).toHaveBeenCalledWith(
            "raw-refresh-token",
            "test-refresh-secret",
        );
    });

    test("should reject when user does not exist", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        User.findById.mockReturnValue(mockUserSelect(null));

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid Refresh Token",
        });
    });

    test("should reject deleted account", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        const deletedUser = makeUser({
            isDeleted: true,
            refreshToken: "stored-hash",
        });

        User.findById.mockReturnValue(mockUserSelect(deletedUser));

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Account is deleted",
        });

        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("should reject invalid stored refresh token", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        const user = makeUser({
            refreshToken: "stored-hash",
        });

        User.findById.mockReturnValue(mockUserSelect(user));

        bcrypt.compare.mockResolvedValue(false);

        await expect(refreshAccessToken(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Refresh token is invalid",
        });

        expect(bcrypt.compare).toHaveBeenCalledWith(
            "raw-refresh-token",
            "stored-hash",
        );
    });

    test("should refresh tokens successfully", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        const user = makeUser({
            refreshToken: "stored-hash",
        });

        User.findById
            .mockReturnValueOnce(mockUserSelect(user))
            .mockResolvedValueOnce(user);

        bcrypt.compare.mockResolvedValue(true);

        await refreshAccessToken(req, res, next);

        expect(bcrypt.compare).toHaveBeenCalledWith(
            "raw-refresh-token",
            "stored-hash",
        );

        expect(user.generateAccessToken).toHaveBeenCalledTimes(1);

        expect(user.generateRefreshToken).toHaveBeenCalledTimes(1);

        expect(bcrypt.hash).toHaveBeenCalledWith("refresh-token", 10);

        expect(user.refreshToken).toBe("hashed-refresh-token");

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });

        expect(res.cookie).toHaveBeenCalledWith("accessToken", "access-token", {
            httpOnly: true,
            secure: false,
        });

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token",
            {
                httpOnly: true,
                secure: false,
            },
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should rotate refresh token rather than reuse old token", async () => {
        jwt.verify.mockReturnValue({
            _id: "user123",
        });

        const user = makeUser({
            refreshToken: "old-hash",
        });

        User.findById
            .mockReturnValueOnce(mockUserSelect(user))
            .mockResolvedValueOnce(user);

        bcrypt.compare.mockResolvedValue(true);

        await refreshAccessToken(req, res, next);

        expect(user.generateRefreshToken).toHaveBeenCalled();

        expect(bcrypt.hash).toHaveBeenCalledWith("refresh-token", 10);

        expect(user.refreshToken).toBe("hashed-refresh-token");
    });
});

describe("logout", () => {
    beforeEach(() => {
        req.user = {
            _id: "user123",
        };
    });

    test("should clear stored refresh token", async () => {
        User.findByIdAndUpdate.mockResolvedValue(
            makeUser({
                refreshToken: null,
            }),
        );

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
    });

    test("should clear access token cookie", async () => {
        User.findByIdAndUpdate.mockResolvedValue(makeUser());

        await logout(req, res, next);

        expect(res.clearCookie).toHaveBeenCalledWith("accessToken", {
            httpOnly: true,
            secure: false,
        });
    });

    test("should clear refresh token cookie", async () => {
        User.findByIdAndUpdate.mockResolvedValue(makeUser());

        await logout(req, res, next);

        expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
            httpOnly: true,
            secure: false,
        });
    });

    test("should return successful logout response", async () => {
        User.findByIdAndUpdate.mockResolvedValue(makeUser());

        await logout(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
            }),
        );
    });
});

describe("resendEmailVerification", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
        };
    });

    test("should reject non-existent active user", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });

        expect(User.findOne).toHaveBeenCalledWith({
            email: "test@example.com",
            isDeleted: false,
        });
    });

    test("should reject deleted user", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject already verified user", async () => {
        const user = makeUser({
            isEmailVerified: true,
        });

        User.findOne.mockResolvedValue(user);

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 409,
            message: "User is already verified",
        });

        expect(user.generateTemporaryToken).not.toHaveBeenCalled();
    });

    test("should generate a new verification token", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await resendEmailVerification(req, res, next);

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.emailVerificationToken).toBe("hashed-token");

        expect(user.emailVerificationTokenExpiry).toBeInstanceOf(Date);
    });

    test("should save new verification token", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await resendEmailVerification(req, res, next);

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });
    });

    test("should send verification email", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await resendEmailVerification(req, res, next);

        expect(emailVerificationMailGenContent).toHaveBeenCalledWith(
            "testuser",
            "http://localhost:3000/verify-email?token=unhashed-token&id=user123",
        );

        expect(sendEmail).toHaveBeenCalledWith({
            email: "test@example.com",
            subject: "User Account Verification",
            mailGenContent: "<html>verification email</html>",
        });
    });

    test("should return 503 when email sending fails", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("SMTP failure"));

        await expect(
            resendEmailVerification(req, res, next),
        ).rejects.toMatchObject({
            statusCode: 503,
            message: "Failed to send verification email",
        });

        expect(user.save).toHaveBeenCalled();
    });

    test("should return success after sending email", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await resendEmailVerification(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
            }),
        );
    });
});

describe("forgotPassword", () => {
    beforeEach(() => {
        req.body = {
            email: "test@example.com",
        };
    });

    test("should return generic response when user does not exist", async () => {
        User.findOne.mockResolvedValue(null);

        await forgotPassword(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({
            email: "test@example.com",
            isDeleted: false,
        });

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

    test("should generate password reset token", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(user.generateTemporaryToken).toHaveBeenCalledTimes(1);

        expect(user.forgotPasswordToken).toBe("hashed-token");

        expect(user.forgotPasswordTokenExpiry).toBeInstanceOf(Date);
    });

    test("should invalidate existing refresh token", async () => {
        const user = makeUser({
            refreshToken: "old-refresh-hash",
        });

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(user.refreshToken).toBeNull();
    });

    test("should save password reset token", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(user.save).toHaveBeenCalledWith({
            validateBeforeSave: false,
        });
    });

    test("should send password reset email with correct link", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(forgotPasswordMailGenContent).toHaveBeenCalledWith(
            "testuser",
            "http://localhost:3000/reset-password?token=unhashed-token&id=user123",
        );

        expect(sendEmail).toHaveBeenCalledWith({
            email: "test@example.com",
            subject: "Reset Your ClauseNexa Password",
            mailGenContent: expect.any(String),
        });
    });

    test("should return 503 when reset email fails", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockRejectedValue(new Error("SMTP failure"));

        await expect(forgotPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 503,
            message: "Failed to send password reset email",
        });
    });

    test("should return generic success after reset email", async () => {
        const user = makeUser();

        User.findOne.mockResolvedValue(user);

        sendEmail.mockResolvedValue(true);

        await forgotPassword(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                message:
                    "If an account exists with this email, a password reset link has been sent",
            }),
        );
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

    test("should reject when token is missing", async () => {
        req.query.token = undefined;

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token or Id is missing",
        });
    });

    test("should reject when id is missing", async () => {
        req.query.id = undefined;

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token or Id is missing",
        });
    });

    test("should reject when user does not exist", async () => {
        User.findById.mockResolvedValue(null);

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject deleted user", async () => {
        const user = makeUser({
            isDeleted: true,
        });

        User.findById.mockResolvedValue(user);

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject missing reset token", async () => {
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

    test("should reject missing reset token expiry", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                forgotPasswordToken: "hashed-token",
                forgotPasswordTokenExpiry: null,
            }),
        );

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid or expired token",
        });
    });

    test("should reject expired reset token", async () => {
        User.findById.mockResolvedValue(
            makeUser({
                forgotPasswordToken: "hashed-token",
                forgotPasswordTokenExpiry: new Date(Date.now() - 1000),
            }),
        );

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token is expired",
        });
    });

    test("should reject invalid reset token", async () => {
        const user = makeUser({
            forgotPasswordToken: "different-hash",
            forgotPasswordTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        });

        User.findById.mockResolvedValue(user);

        crypto.createHash.mockReturnValue(mockHashChain("computed-hash"));

        await expect(resetPassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "Token is invalid",
        });
    });

    test("should hash reset token using SHA-256", async () => {
        const user = makeUser({
            forgotPasswordToken: "matching-hash",
            forgotPasswordTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        });

        User.findById.mockResolvedValue(user);

        const hashChain = mockHashChain("matching-hash");

        crypto.createHash.mockReturnValue(hashChain);

        await resetPassword(req, res, next);

        expect(crypto.createHash).toHaveBeenCalledWith("sha256");

        expect(hashChain.update).toHaveBeenCalledWith("raw-token");

        expect(hashChain.digest).toHaveBeenCalledWith("hex");
    });

    test("should reset password successfully", async () => {
        const user = makeUser({
            forgotPasswordToken: "matching-hash",
            forgotPasswordTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
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

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
            }),
        );
    });
});

describe("changePassword", () => {
    beforeEach(() => {
        req.user = {
            _id: "user123",
        };

        req.body = {
            currentPassword: "oldPassword123",
            newPassword: "newPassword456",
        };
    });

    test("should reject when user does not exist", async () => {
        User.findById.mockResolvedValue(null);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });

    test("should reject deleted user if controller returns deleted user", async () => {
        const user = makeUser({
            isDeleted: true,
        });

        User.findById.mockResolvedValue(user);

        user.isPasswordCorrect.mockResolvedValue(false);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Current password is incorrect",
        });
    });

    test("should reject incorrect current password", async () => {
        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(false);

        User.findById.mockResolvedValue(user);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "Current password is incorrect",
        });

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("oldPassword123");

        expect(user.save).not.toHaveBeenCalled();
    });

    test("should reject when new password equals current password", async () => {
        req.body.newPassword = "oldPassword123";

        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findById.mockResolvedValue(user);

        await expect(changePassword(req, res, next)).rejects.toMatchObject({
            statusCode: 400,
            message: "New password must be different from current password",
        });

        expect(user.save).not.toHaveBeenCalled();
    });

    test("should change password successfully", async () => {
        const user = makeUser();

        user.isPasswordCorrect.mockResolvedValue(true);

        User.findById.mockResolvedValue(user);

        await changePassword(req, res, next);

        expect(user.isPasswordCorrect).toHaveBeenCalledWith("oldPassword123");

        expect(user.password).toBe("newPassword456");

        expect(user.refreshToken).toBeNull();

        expect(user.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
            }),
        );
    });
});

function userNotUsed() {
    return true;
}
