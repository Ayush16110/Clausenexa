import { jest } from "@jest/globals";

const mockContractCreate = jest.fn();

jest.unstable_mockModule("../../src/models/contract.model.js", () => ({
    Contract: {
        create: mockContractCreate,
    },
}));

const { createContract } =
    await import("../../src/controllers/contract.controller.js");

describe("createContract", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: "user123",
            },
            body: {
                title: "Employment Agreement",
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    test("should create a contract successfully", async () => {
        const createdContract = {
            _id: "contract123",
            userId: "user123",
            title: "Employment Agreement",
            activeDocumentId: null,
            isDeleted: false,
            deletedAt: null,
        };

        mockContractCreate.mockResolvedValue(createdContract);

        await createContract(req, res, next);

        expect(mockContractCreate).toHaveBeenCalledWith({
            title: "Employment Agreement",
            userId: "user123",
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalled();

        expect(next).not.toHaveBeenCalled();
    });

    test("should use authenticated user's id when creating contract", async () => {
        mockContractCreate.mockResolvedValue({
            _id: "contract123",
            userId: "user123",
            title: "Employment Agreement",
        });

        await createContract(req, res, next);

        expect(mockContractCreate).toHaveBeenCalledWith({
            title: "Employment Agreement",
            userId: "user123",
        });
    });

    test("should pass the provided title to Contract.create", async () => {
        req.body.title = "Vendor Agreement";

        mockContractCreate.mockResolvedValue({
            _id: "contract123",
            userId: "user123",
            title: "Vendor Agreement",
        });

        await createContract(req, res, next);

        expect(mockContractCreate).toHaveBeenCalledWith({
            title: "Vendor Agreement",
            userId: "user123",
        });
    });

    test("should call next with an ApiError if contract creation fails", async () => {
        mockContractCreate.mockResolvedValue(null);

        createContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 500,
                message: "Failed to create contract",
            }),
        );

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should call next with database error if Contract.create fails", async () => {
        const databaseError = new Error("Database error");

        mockContractCreate.mockRejectedValue(databaseError);

        createContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});
