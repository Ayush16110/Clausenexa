import { jest } from "@jest/globals";

const mockContractFindOne = jest.fn();

const mockDocumentFindOne = jest.fn();
const mockDocumentFind = jest.fn();
const mockDocumentDeleteOne = jest.fn();
const mockDocumentConstructor = jest.fn();

const mockUploadToR2 = jest.fn();
const mockDeleteFromR2 = jest.fn();
const mockCreateProcessingJob = jest.fn();

const mockGenerateDocumentStorageKey = jest.fn();
const mockGenerateFileHash = jest.fn();

jest.unstable_mockModule("../../src/models/contract.model.js", () => ({
    Contract: {
        findOne: mockContractFindOne,
    },
}));

jest.unstable_mockModule("../../src/models/document.model.js", () => ({
    Document: Object.assign(
        function Document(data) {
            return mockDocumentConstructor(data);
        },
        {
            findOne: mockDocumentFindOne,
            find: mockDocumentFind,
            deleteOne: mockDocumentDeleteOne,
        },
    ),
}));

jest.unstable_mockModule("../../src/services/r2.service.js", () => ({
    uploadToR2: mockUploadToR2,
    deleteFromR2: mockDeleteFromR2,
}));

jest.unstable_mockModule(
    "../../src/services/document-processing.service.js",
    () => ({
        createProcessingJob: mockCreateProcessingJob,
    }),
);

jest.unstable_mockModule("../../src/utils/storage.utils.js", () => ({
    generateDocumentStorageKey: mockGenerateDocumentStorageKey,
}));

jest.unstable_mockModule("../../src/utils/hash.utils.js", () => ({
    generateFileHash: mockGenerateFileHash,
}));

const { createDocument, getAllDocuments, getDocumentById, deleteDocument } =
    await import("../../src/controllers/document.controller.js");

const contractId = "507f1f77bcf86cd799439011";
const documentId = "507f191e810c19729de860ea";
const userId = "507f1f77bcf86cd799439012";

const createMockResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const createMockNext = () => jest.fn();

const createMockFile = () => ({
    originalname: "employment-agreement.pdf",
    mimetype: "application/pdf",
    size: 1024,
    buffer: Buffer.from("fake pdf content"),
});

const createMockDocument = (overrides = {}) => ({
    _id: documentId,
    contractId,
    userId,
    fileName: "employment-agreement.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    fileHash: "mock-file-hash",
    storageKey: null,
    processingStatus: "queued",
    processingStage: "queued",
    processingProgress: 0,
    processingError: null,
    jobId: null,
    processingVersion: 1,
    activeProcessingVersion: null,
    isDeleted: false,
    deletedAt: null,
    isNew: true,
    save: jest.fn(),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();

    mockGenerateFileHash.mockReturnValue("mock-file-hash");

    mockGenerateDocumentStorageKey.mockReturnValue(
        `contracts/${contractId}/documents/${documentId}/original.pdf`,
    );

    mockUploadToR2.mockResolvedValue(
        `contracts/${contractId}/documents/${documentId}/original.pdf`,
    );

    mockDeleteFromR2.mockResolvedValue(undefined);

    mockCreateProcessingJob.mockResolvedValue({
        jobId: "job-123",
    });

    mockDocumentDeleteOne.mockResolvedValue({
        acknowledged: true,
        deletedCount: 1,
    });
});

describe("createDocument", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            user: {
                _id: userId,
            },
            params: {
                contractId,
            },
            file: createMockFile(),
        };

        res = createMockResponse();
        next = createMockNext();
    });

    test("should return 400 for an invalid contract ID", async () => {
        req.params.contractId = "invalid-contract-id";

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                message: "Invalid contract ID",
            }),
        );

        expect(mockContractFindOne).not.toHaveBeenCalled();
        expect(mockDocumentFindOne).not.toHaveBeenCalled();
        expect(mockUploadToR2).not.toHaveBeenCalled();
    });

    test("should return 400 when document file is missing", async () => {
        req.file = undefined;

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                message: "Document file is required",
            }),
        );

        expect(mockContractFindOne).not.toHaveBeenCalled();
        expect(mockDocumentFindOne).not.toHaveBeenCalled();
        expect(mockUploadToR2).not.toHaveBeenCalled();
    });

    test("should return 404 when contract is not found", async () => {
        mockContractFindOne.mockResolvedValue(null);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(mockDocumentFindOne).not.toHaveBeenCalled();
        expect(mockUploadToR2).not.toHaveBeenCalled();
    });

    test("should detect duplicate document upload", async () => {
        const existingDocument = {
            _id: documentId,
            contractId,
            fileHash: "mock-file-hash",
            isDeleted: false,
        };

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(existingDocument);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockGenerateFileHash).toHaveBeenCalledWith(req.file.buffer);

        expect(mockDocumentFindOne).toHaveBeenCalledWith({
            contractId,
            fileHash: "mock-file-hash",
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                message:
                    "This document has already been uploaded to this contract",
            }),
        );

        expect(mockUploadToR2).not.toHaveBeenCalled();
        expect(mockCreateProcessingJob).not.toHaveBeenCalled();
    });

    test("should successfully upload document and create processing job", async () => {
        const document = createMockDocument({
            isNew: true,
        });

        document.save
            .mockResolvedValueOnce(document)
            .mockResolvedValueOnce(document);

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockGenerateFileHash).toHaveBeenCalledWith(req.file.buffer);

        expect(mockDocumentConstructor).toHaveBeenCalledWith({
            contractId,
            userId,
            fileName: "employment-agreement.pdf",
            mimeType: "application/pdf",
            fileSize: 1024,
            fileHash: "mock-file-hash",
        });

        expect(mockGenerateDocumentStorageKey).toHaveBeenCalledWith(
            contractId,
            documentId,
        );

        expect(mockUploadToR2).toHaveBeenCalledWith({
            buffer: req.file.buffer,
            storageKey: `contracts/${contractId}/documents/${documentId}/original.pdf`,
            mimeType: "application/pdf",
        });

        expect(document.storageKey).toBe(
            `contracts/${contractId}/documents/${documentId}/original.pdf`,
        );

        expect(document.save).toHaveBeenCalledTimes(2);

        expect(mockCreateProcessingJob).toHaveBeenCalledWith(documentId);

        expect(document.jobId).toBe("job-123");

        expect(res.status).toHaveBeenCalledWith(202);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 202,
                data: {
                    documentId,
                    jobId: "job-123",
                    processingStatus: "queued",
                },
                message: "Document uploaded and processing started",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
        expect(mockDeleteFromR2).not.toHaveBeenCalled();
        expect(mockDocumentDeleteOne).not.toHaveBeenCalled();
    });

    test("should propagate R2 upload failure and clean up R2", async () => {
        const r2Error = new Error("R2 upload failed");

        const document = createMockDocument({
            isNew: true,
        });

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        mockUploadToR2.mockRejectedValue(r2Error);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockUploadToR2).toHaveBeenCalled();

        expect(mockDocumentDeleteOne).not.toHaveBeenCalled();

        expect(mockDeleteFromR2).toHaveBeenCalledWith(
            `contracts/${contractId}/documents/${documentId}/original.pdf`,
        );

        expect(next).toHaveBeenCalledWith(r2Error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should clean up document metadata and R2 when document save fails", async () => {
        const databaseError = new Error("Database error");

        const document = createMockDocument({
            isNew: false,
        });

        document.save.mockRejectedValueOnce(databaseError);

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentDeleteOne).toHaveBeenCalledWith({
            _id: documentId,
        });

        expect(mockDeleteFromR2).toHaveBeenCalledWith(
            `contracts/${contractId}/documents/${documentId}/original.pdf`,
        );

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should clean up document metadata and R2 when processing job creation fails", async () => {
        const processingError = new Error("Processing service unavailable");

        const document = createMockDocument({
            isNew: false,
        });

        document.save.mockResolvedValueOnce(document);

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        mockCreateProcessingJob.mockRejectedValue(processingError);

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(document.save).toHaveBeenCalledTimes(1);

        expect(mockCreateProcessingJob).toHaveBeenCalledWith(documentId);

        expect(mockDocumentDeleteOne).toHaveBeenCalledWith({
            _id: documentId,
        });

        expect(mockDeleteFromR2).toHaveBeenCalledWith(
            `contracts/${contractId}/documents/${documentId}/original.pdf`,
        );

        expect(next).toHaveBeenCalledWith(processingError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate processing job failure when document cleanup fails", async () => {
        const processingError = new Error("Processing service unavailable");

        const document = createMockDocument({
            isNew: false,
        });

        document.save.mockResolvedValueOnce(document);

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        mockCreateProcessingJob.mockRejectedValue(processingError);

        mockDocumentDeleteOne.mockRejectedValue(
            new Error("Cleanup database failure"),
        );

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentDeleteOne).toHaveBeenCalled();

        expect(mockDeleteFromR2).toHaveBeenCalled();

        expect(next).toHaveBeenCalledWith(processingError);
    });

    test("should propagate processing job failure when R2 cleanup fails", async () => {
        const processingError = new Error("Processing service unavailable");

        const document = createMockDocument({
            isNew: false,
        });

        document.save.mockResolvedValueOnce(document);

        mockDocumentConstructor.mockReturnValue(document);

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFindOne.mockResolvedValue(null);

        mockCreateProcessingJob.mockRejectedValue(processingError);

        mockDeleteFromR2.mockRejectedValue(new Error("R2 cleanup failure"));

        createDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentDeleteOne).toHaveBeenCalled();

        expect(mockDeleteFromR2).toHaveBeenCalled();

        expect(next).toHaveBeenCalledWith(processingError);
    });
});

describe("getAllDocuments", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            user: {
                _id: userId,
            },
            params: {
                contractId,
            },
        };

        res = createMockResponse();
        next = createMockNext();
    });

    test("should return 400 for an invalid contract ID", async () => {
        req.params.contractId = "invalid-contract-id";

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                message: "Invalid contract ID",
            }),
        );

        expect(mockContractFindOne).not.toHaveBeenCalled();
        expect(mockDocumentFind).not.toHaveBeenCalled();
    });

    test("should return 404 when contract is not found", async () => {
        mockContractFindOne.mockResolvedValue(null);

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(mockDocumentFind).not.toHaveBeenCalled();
    });

    test("should return all active documents for the contract", async () => {
        const documents = [
            {
                _id: documentId,
                contractId,
                userId,
                fileName: "contract-1.pdf",
                isDeleted: false,
            },
            {
                _id: "507f191e810c19729de860eb",
                contractId,
                userId,
                fileName: "contract-2.pdf",
                isDeleted: false,
            },
        ];

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFind.mockResolvedValue(documents);

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentFind).toHaveBeenCalledWith({
            contractId,
            userId,
            isDeleted: false,
        });

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: documents,
                message: "Documents fetched successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should return an empty array when the contract has no documents", async () => {
        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFind.mockResolvedValue([]);

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: [],
                message: "Documents fetched successfully",
                success: true,
            }),
        );
    });

    test("should propagate database error while finding contract", async () => {
        const databaseError = new Error("Database error");

        mockContractFindOne.mockRejectedValue(databaseError);

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(mockDocumentFind).not.toHaveBeenCalled();
    });

    test("should propagate database error while finding documents", async () => {
        const databaseError = new Error("Database error");

        mockContractFindOne.mockResolvedValue({
            _id: contractId,
            userId,
            isDeleted: false,
        });

        mockDocumentFind.mockRejectedValue(databaseError);

        getAllDocuments(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe("getDocumentById", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            user: {
                _id: userId,
            },
            params: {
                documentId,
            },
        };

        res = createMockResponse();
        next = createMockNext();
    });

    test("should return 400 for an invalid document ID", async () => {
        req.params.documentId = "invalid-document-id";

        getDocumentById(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                message: "Invalid document ID",
            }),
        );

        expect(mockDocumentFindOne).not.toHaveBeenCalled();
    });

    test("should return 404 when document is not found", async () => {
        mockDocumentFindOne.mockResolvedValue(null);

        getDocumentById(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentFindOne).toHaveBeenCalledWith({
            _id: documentId,
            userId,
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Document not found",
            }),
        );

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should return the document successfully", async () => {
        const document = {
            _id: documentId,
            contractId,
            userId,
            fileName: "employment-agreement.pdf",
            isDeleted: false,
        };

        mockDocumentFindOne.mockResolvedValue(document);

        getDocumentById(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentFindOne).toHaveBeenCalledWith({
            _id: documentId,
            userId,
            isDeleted: false,
        });

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: document,
                message: "Document fetched successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should propagate database error while fetching document", async () => {
        const databaseError = new Error("Database error");

        mockDocumentFindOne.mockRejectedValue(databaseError);

        getDocumentById(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe("deleteDocument", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            user: {
                _id: userId,
            },
            params: {
                documentId,
            },
        };

        res = createMockResponse();
        next = createMockNext();
    });

    test("should return 400 for an invalid document ID", async () => {
        req.params.documentId = "invalid-document-id";

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                message: "Invalid document ID",
            }),
        );

        expect(mockDocumentFindOne).not.toHaveBeenCalled();
        expect(mockContractFindOne).not.toHaveBeenCalled();
    });

    test("should return 404 when document is not found", async () => {
        mockDocumentFindOne.mockResolvedValue(null);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockDocumentFindOne).toHaveBeenCalledWith({
            _id: documentId,
            userId,
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Document not found",
            }),
        );

        expect(mockContractFindOne).not.toHaveBeenCalled();
    });

    test("should return 404 when associated contract is not found", async () => {
        const document = createMockDocument();

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockResolvedValue(null);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(mockContractFindOne).toHaveBeenCalledWith({
            _id: document.contractId,
            userId,
            isDeleted: false,
        });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                message: "Contract not found",
            }),
        );

        expect(document.save).not.toHaveBeenCalled();
    });

    test("should soft delete a non-active document successfully", async () => {
        const document = createMockDocument({
            save: jest.fn().mockResolvedValue(undefined),
        });

        const contract = {
            _id: contractId,
            userId,
            activeDocumentId: null,
            isDeleted: false,
            save: jest.fn(),
        };

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockResolvedValue(contract);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(document.isDeleted).toBe(true);
        expect(document.deletedAt).toBeInstanceOf(Date);

        expect(contract.save).not.toHaveBeenCalled();

        expect(document.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: null,
                message: "Document deleted successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should clear activeDocumentId when deleting the active document", async () => {
        const equalsMock = jest.fn().mockReturnValue(true);

        const document = createMockDocument({
            save: jest.fn().mockResolvedValue(undefined),
        });

        const contract = {
            _id: contractId,
            userId,
            activeDocumentId: {
                equals: equalsMock,
            },
            isDeleted: false,
            save: jest.fn().mockResolvedValue(undefined),
        };

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockResolvedValue(contract);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(equalsMock).toHaveBeenCalledWith(document._id);

        expect(contract.activeDocumentId).toBeNull();

        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(document.isDeleted).toBe(true);
        expect(document.deletedAt).toBeInstanceOf(Date);
        expect(document.save).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 200,
                data: null,
                message: "Document deleted successfully",
                success: true,
            }),
        );

        expect(next).not.toHaveBeenCalled();
    });

    test("should propagate database error while finding document", async () => {
        const databaseError = new Error("Database error");

        mockDocumentFindOne.mockRejectedValue(databaseError);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(mockContractFindOne).not.toHaveBeenCalled();
    });

    test("should propagate database error while finding contract", async () => {
        const databaseError = new Error("Database error");

        const document = createMockDocument();

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockRejectedValue(databaseError);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(document.save).not.toHaveBeenCalled();
    });

    test("should propagate database error while saving active contract", async () => {
        const databaseError = new Error("Database error");

        const document = createMockDocument({
            save: jest.fn(),
        });

        const contract = {
            _id: contractId,
            userId,
            activeDocumentId: {
                equals: jest.fn().mockReturnValue(true),
            },
            isDeleted: false,
            save: jest.fn().mockRejectedValue(databaseError),
        };

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockResolvedValue(contract);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(contract.activeDocumentId).toBeNull();

        expect(contract.save).toHaveBeenCalledTimes(1);

        expect(document.save).not.toHaveBeenCalled();

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("should propagate database error while saving document", async () => {
        const databaseError = new Error("Database error");

        const document = createMockDocument({
            save: jest.fn().mockRejectedValue(databaseError),
        });

        const contract = {
            _id: contractId,
            userId,
            activeDocumentId: null,
            isDeleted: false,
            save: jest.fn(),
        };

        mockDocumentFindOne.mockResolvedValue(document);
        mockContractFindOne.mockResolvedValue(contract);

        deleteDocument(req, res, next);

        await new Promise(setImmediate);

        expect(document.isDeleted).toBe(true);
        expect(document.deletedAt).toBeInstanceOf(Date);

        expect(document.save).toHaveBeenCalledTimes(1);

        expect(next).toHaveBeenCalledWith(databaseError);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });
});
