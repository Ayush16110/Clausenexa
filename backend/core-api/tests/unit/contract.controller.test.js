import { jest } from "@jest/globals";

const mockContractCreate = jest.fn();
const mockContractFind = jest.fn();
const mockContractFindOne = jest.fn();

jest.unstable_mockModule("../../src/models/contract.model.js", () => ({
    Contract: {
        create: mockContractCreate,
        find: mockContractFind,
        findOne: mockContractFindOne,
    },
}));

const {
    createContract,
    getContracts,
    getContractByID,
    updateContract,
    deleteContract,
} = await import("../../src/controllers/contract.controller.js");

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

describe("getContracts", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: "user123",
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    test("should return all contracts belonging to the authenticated user", async () => {
        const contracts = [
            {
                _id: "contract1",
                userId: "user123",
                title: "Employment Agreement",
                isDeleted: false,
            },
            {
                _id: "contract2",
                userId: "user123",
                title: "Lease Agreement",
                isDeleted: false,
            },
        ];

        const sort = jest.fn().mockResolvedValue(contracts);

        mockContractFind.mockReturnValue({
            sort,
        });

        await getContracts(req, res, next);

        expect(mockContractFind).toHaveBeenCalledWith({
            userId: "user123",
            isDeleted: false,
        });

        expect(sort).toHaveBeenCalledWith({
            createdAt: -1,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("should return an empty array when user has no contracts", async () => {
        const sort = jest.fn().mockResolvedValue([]);

        mockContractFind.mockReturnValue({
            sort,
        });

        await getContracts(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("should call next when fetching contracts fails", async () => {
        const databaseError = new Error("Database error");

        mockContractFind.mockReturnValue({
            sort: jest.fn().mockRejectedValue(databaseError),
        });

        getContracts(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);
    });
});

describe("getContractByID", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: "user123",
            },
            params: {
                contractId: "contract123",
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    test("should return the contract belonging to the authenticated user", async () => {
        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Employment Agreement",
            isDeleted: false,
        };

        mockContractFindOne.mockResolvedValue(contract);

        await getContractByID(req, res, next);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: "contract123",
            userId: "user123",
            isDeleted: false,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("should return 404 when contract is not found", async () => {
        mockContractFindOne.mockResolvedValue(null);

        getContractByID(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should call next when fetching contract fails", async () => {
        const databaseError = new Error("Database error");

        mockContractFindOne.mockRejectedValue(databaseError);

        getContractByID(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);
    });
});

describe("updateContract", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: "user123",
            },
            params: {
                contractId: "contract123",
            },
            body: {
                title: "Updated Employment Agreement",
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    test("should update the contract title successfully", async () => {
        const updatedContract = {
            _id: "contract123",
            userId: "user123",
            title: "Updated Employment Agreement",
            isDeleted: false,
        };

        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Old Employment Agreement",
            isDeleted: false,
            save: jest.fn().mockResolvedValue(updatedContract),
        };

        mockContractFindOne.mockResolvedValue(contract);

        updateContract(req, res, next);
        await new Promise(setImmediate);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: "contract123",
            userId: "user123",
            isDeleted: false,
        });

        expect(contract.title).toBe("Updated Employment Agreement");
        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: updatedContract,
                message: "Title updated successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should return 404 when contract is not found", async () => {
        mockContractFindOne.mockResolvedValue(null);

        updateContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate database errors while finding contract", async () => {
        const databaseError = new Error("Database error");

        mockContractFindOne.mockRejectedValue(databaseError);

        updateContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate database errors while saving contract", async () => {
        const databaseError = new Error("Database error");

        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Old Employment Agreement",
            isDeleted: false,
            save: jest.fn().mockRejectedValue(databaseError),
        };

        mockContractFindOne.mockResolvedValue(contract);

        updateContract(req, res, next);

        await new Promise(setImmediate);

        expect(contract.title).toBe("Updated Employment Agreement");
        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should return the updated contract returned by save", async () => {
        const updatedContract = {
            _id: "contract123",
            userId: "user123",
            title: "Updated Employment Agreement",
            isDeleted: false,
        };

        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Old Employment Agreement",
            isDeleted: false,
            save: jest.fn().mockResolvedValue(updatedContract),
        };

        mockContractFindOne.mockResolvedValue(contract);

        updateContract(req, res, next);
        await new Promise(setImmediate);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: updatedContract,
            }),
        );
    });
});

describe("deleteContract", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: "user123",
            },
            params: {
                contractId: "contract123",
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();
    });

    test("should soft delete the contract successfully", async () => {
        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Employment Agreement",
            isDeleted: false,
            deletedAt: null,
            save: jest.fn().mockResolvedValue({
                _id: "contract123",
                userId: "user123",
                title: "Employment Agreement",
                isDeleted: true,
                deletedAt: new Date(),
            }),
        };

        mockContractFindOne.mockResolvedValue(contract);

        deleteContract(req, res, next);
        await new Promise(setImmediate);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: "contract123",
            userId: "user123",
            isDeleted: false,
        });

        expect(contract.isDeleted).toBe(true);
        expect(contract.deletedAt).toBeInstanceOf(Date);
        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: null,
                message: "Contract deleted successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should return 404 when contract is not found", async () => {
        mockContractFindOne.mockResolvedValue(null);

        deleteContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate database errors while finding contract", async () => {
        const databaseError = new Error("Database error");

        mockContractFindOne.mockRejectedValue(databaseError);

        deleteContract(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate database errors while deleting contract", async () => {
        const databaseError = new Error("Database error");

        const contract = {
            _id: "contract123",
            userId: "user123",
            title: "Employment Agreement",
            isDeleted: false,
            deletedAt: null,
            save: jest.fn().mockRejectedValue(databaseError),
        };

        mockContractFindOne.mockResolvedValue(contract);

        deleteContract(req, res, next);

        await new Promise(setImmediate);

        expect(contract.isDeleted).toBe(true);
        expect(contract.deletedAt).toBeInstanceOf(Date);
        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});
