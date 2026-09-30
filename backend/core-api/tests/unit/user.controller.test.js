import { jest } from "@jest/globals";

const mockUser = {
    findById: jest.fn(),
    findOne: jest.fn(),
};

const mockApiResponse = jest.fn();

const mockApiError = jest.fn((statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.message = message;
    return error;
});

jest.unstable_mockModule("../../src/models/user.model.js", () => ({
    User: mockUser,
}));

jest.unstable_mockModule("../../src/utils/api-error.js", () => ({
    ApiError: mockApiError,
}));

jest.unstable_mockModule("../../src/utils/api-response.js", () => ({
    ApiResponse: mockApiResponse,
}));

jest.unstable_mockModule("../../src/utils/async-handler.js", () => ({
    asyncHandler: (fn) => fn,
}));

jest.unstable_mockModule("../../src/config/env.js", () => ({
    default: {
        nodeEnv: "test",
    },
}));

const { getCurrentUser, updateUser, deleteUser } =
    await import("../../src/controllers/user.controller.js");

const createResponseMock = () => {
    const res = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);

    return res;
};

const createRequestMock = (body = {}) => ({
    user: {
        _id: "user-id-123",
    },
    body,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("getCurrentUser", () => {
    test("should return the current user", async () => {
        const req = createRequestMock();
        const res = createResponseMock();

        const user = {
            _id: "user-id-123",
            username: "testuser",
            email: "test@example.com",
            fullName: "Test User",
        };

        const select = jest.fn().mockResolvedValue(user);

        mockUser.findById.mockReturnValue({
            select,
        });

        mockApiResponse.mockImplementation((statusCode, data, message) => ({
            statusCode,
            data,
            message,
        }));

        await getCurrentUser(req, res);

        expect(mockUser.findById).toHaveBeenCalledWith("user-id-123");

        expect(select).toHaveBeenCalledWith(
            "-password -refreshToken -forgotPasswordToken -forgotPasswordTokenExpiry -emailVerificationToken -emailVerificationTokenExpiry",
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            statusCode: 200,
            data: user,
            message: "User fetched successfully",
        });
    });

    test("should throw 404 when user is not found", async () => {
        const req = createRequestMock();
        const res = createResponseMock();

        const select = jest.fn().mockResolvedValue(null);

        mockUser.findById.mockReturnValue({
            select,
        });

        await expect(getCurrentUser(req, res)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });

        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("updateUser", () => {
    test("should update full name successfully", async () => {
        const req = createRequestMock({
            fullName: "Updated Name",
        });

        const res = createResponseMock();

        const user = {
            _id: "user-id-123",
            username: "testuser",
            fullName: "Old Name",
            usernameLastChangedAt: null,
            save: jest.fn().mockResolvedValue(true),
        };

        const updatedUser = {
            _id: "user-id-123",
            username: "testuser",
            fullName: "Updated Name",
        };

        const select = jest.fn().mockResolvedValue(updatedUser);

        mockUser.findById.mockReturnValueOnce(user).mockReturnValueOnce({
            select,
        });

        mockApiResponse.mockImplementation((statusCode, data, message) => ({
            statusCode,
            data,
            message,
        }));

        await updateUser(req, res);

        expect(user.fullName).toBe("Updated Name");
        expect(user.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            statusCode: 200,
            data: updatedUser,
            message: "Changes updated and saved successfully",
        });
    });
    test("should update username successfully", async () => {
        const req = createRequestMock({
            username: "newusername",
        });

        const res = createResponseMock();

        const user = {
            _id: "user-id-123",
            username: "oldusername",
            fullName: "Test User",
            usernameLastChangedAt: null,
            save: jest.fn().mockResolvedValue(true),
        };

        const updatedUser = {
            _id: "user-id-123",
            username: "newusername",
        };

        const select = jest.fn().mockResolvedValue(updatedUser);

        mockUser.findById.mockReturnValueOnce(user).mockReturnValueOnce({
            select,
        });

        mockUser.findOne.mockResolvedValue(null);

        mockApiResponse.mockImplementation((statusCode, data, message) => ({
            statusCode,
            data,
            message,
        }));

        await updateUser(req, res);

        expect(mockUser.findOne).toHaveBeenCalledWith({
            username: "newusername",
            isDeleted: false,
            _id: { $ne: "user-id-123" },
        });

        expect(user.username).toBe("newusername");
        expect(user.usernameLastChangedAt).toBeInstanceOf(Date);
        expect(user.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);
    });
    test("should reject when username already exists", async () => {
        const req = createRequestMock({
            username: "existinguser",
        });

        const res = createResponseMock();

        const user = {
            _id: "user-id-123",
            username: "oldusername",
            usernameLastChangedAt: null,
            save: jest.fn(),
        };

        mockUser.findById.mockResolvedValue(user);

        mockUser.findOne.mockResolvedValue({
            _id: "another-user-id",
            username: "existinguser",
            isDeleted: false,
        });

        await expect(updateUser(req, res)).rejects.toMatchObject({
            statusCode: 409,
            message: "Username already exists",
        });

        expect(user.save).not.toHaveBeenCalled();
    });
    test("should reject username change within 30 days", async () => {
        const req = createRequestMock({
            username: "newusername",
        });

        const res = createResponseMock();

        const recentChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

        const user = {
            _id: "user-id-123",
            username: "oldusername",
            usernameLastChangedAt: recentChange,
            save: jest.fn(),
        };

        mockUser.findById.mockResolvedValue(user);

        await expect(updateUser(req, res)).rejects.toMatchObject({
            statusCode: 429,
            message: "Username can only be changed once every 30 days",
        });

        expect(mockUser.findOne).not.toHaveBeenCalled();
        expect(user.save).not.toHaveBeenCalled();
    });
    test("should throw 404 when user is not found", async () => {
        const req = createRequestMock({
            fullName: "Updated Name",
        });

        const res = createResponseMock();

        mockUser.findById.mockResolvedValue(null);

        await expect(updateUser(req, res)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });
    });
});

describe("deleteUser", () => {
    test("should soft delete the user successfully", async () => {
        const req = createRequestMock();
        const res = createResponseMock();

        const user = {
            _id: "user-id-123",
            isDeleted: false,
            deletedAt: null,
            refreshToken: "hashed-refresh-token",
            save: jest.fn().mockResolvedValue(true),
        };

        mockUser.findById.mockResolvedValue(user);

        mockApiResponse.mockImplementation((statusCode, data, message) => ({
            statusCode,
            data,
            message,
        }));

        await deleteUser(req, res);

        expect(user.isDeleted).toBe(true);
        expect(user.deletedAt).toBeInstanceOf(Date);
        expect(user.refreshToken).toBeNull();
        expect(user.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.clearCookie).toHaveBeenNthCalledWith(1, "accessToken", {
            httpOnly: true,
            secure: false,
        });

        expect(res.clearCookie).toHaveBeenNthCalledWith(2, "refreshToken", {
            httpOnly: true,
            secure: false,
        });

        expect(res.json).toHaveBeenCalledWith({
            statusCode: 200,
            data: null,
            message: "Account deleted successfully",
        });
    });

    test("should throw 404 when deleting a non-existent user", async () => {
        const req = createRequestMock();
        const res = createResponseMock();

        mockUser.findById.mockResolvedValue(null);

        await expect(deleteUser(req, res)).rejects.toMatchObject({
            statusCode: 404,
            message: "User not found",
        });

        expect(res.status).not.toHaveBeenCalled();
        expect(res.clearCookie).not.toHaveBeenCalled();
    });
});
