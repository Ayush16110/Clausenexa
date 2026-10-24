import {
    jest,
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
} from "@jest/globals";
import { UnrecoverableError } from "bullmq";

// Mock external dependencies before importing the service.
// This is required for Jest's ES module mocking.

const mockUpdateDocument = jest.fn();
const mockUploadDocument = jest.fn();

jest.unstable_mockModule("../../src/config/env.js", () => ({
    default: {
        doclingBaseUrl: "http://localhost:5001",
        doclingTimeoutMs: 30_000,
        doclingPollIntervalMs: 0,
    },
}));

jest.unstable_mockModule("../../src/services/document.service.js", () => ({
    updateDocument: mockUpdateDocument,
}));

jest.unstable_mockModule("../../src/services/storage.service.js", () => ({
    uploadDocument: mockUploadDocument,
}));

// Import the service only after registering the ESM mocks.
const { extractMarkdownFromPdf } =
    await import("../../src/services/docling.service.js");

const { DocumentConversionStateEnum } =
    await import("../../src/utils/document.constants.js");

describe("extractMarkdownFromPdf", () => {
    let document;
    let pdfBuffer;
    let fetchSpy;

    const markdown = "# Contract\n\nThis is a test contract.";

    const createResponse = ({
        ok = true,
        status = 200,
        body = {},
        headers = {},
    } = {}) => ({
        ok,
        status,
        headers: {
            get: (name) => headers[name.toLowerCase()] ?? null,
        },
        json: jest.fn().mockResolvedValue(body),
    });

    const createSuccessfulFetchSequence = (taskId = "task-123") => {
        fetchSpy
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_id: taskId,
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_status: "success",
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        status: "success",
                        document: {
                            md_content: markdown,
                        },
                    },
                }),
            );
    };

    beforeEach(() => {
        jest.clearAllMocks();

        document = {
            _id: "document-123",
            fileName: "contract.pdf",
            storageKey: "users/user-123/documents/document-123/original.pdf",
            doclingTaskId: null,
        };

        pdfBuffer = Buffer.from("%PDF-1.7 test PDF content");

        fetchSpy = jest.spyOn(globalThis, "fetch");

        // By default, database updates succeed and return the document.
        mockUpdateDocument.mockImplementation(async (_documentId, updates) => ({
            ...document,
            ...updates,
        }));

        mockUploadDocument.mockResolvedValue(undefined);
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    // -------------------------------------------------------
    // 1. Successful conversion
    // -------------------------------------------------------

    test("submits, polls, retrieves Markdown, uploads it, and marks conversion completed", async () => {
        createSuccessfulFetchSequence();

        const result = await extractMarkdownFromPdf(
            document,
            pdfBuffer,
            document.fileName,
        );

        // Returns the converted Markdown.
        expect(result).toBe(markdown);

        // Submission, polling, and result retrieval.
        expect(fetchSpy).toHaveBeenCalledTimes(3);

        expect(fetchSpy.mock.calls[0][0]).toBe(
            "http://localhost:5001/v1/convert/file/async",
        );

        expect(fetchSpy.mock.calls[0][1].method).toBe("POST");

        expect(fetchSpy.mock.calls[1][0]).toBe(
            "http://localhost:5001/v1/status/poll/task-123",
        );

        expect(fetchSpy.mock.calls[2][0]).toBe(
            "http://localhost:5001/v1/result/task-123",
        );

        // Markdown is uploaded under original.md.
        expect(mockUploadDocument).toHaveBeenCalledWith(
            "users/user-123/documents/document-123/original.md",
            markdown,
            "text/markdown; charset=utf-8",
        );

        // The conversion lifecycle includes SUBMITTING and SUBMITTED.
        expect(mockUpdateDocument).toHaveBeenCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.SUBMITTING,
        });

        expect(mockUpdateDocument).toHaveBeenCalledWith(document._id, {
            doclingTaskId: "task-123",
            doclingConversionState: DocumentConversionStateEnum.SUBMITTED,
        });

        // COMPLETED is persisted only after the upload succeeds.
        expect(mockUpdateDocument).toHaveBeenLastCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.COMPLETED,
        });
    });

    // -------------------------------------------------------
    // 2. Existing task ID
    // -------------------------------------------------------

    test("reuses an existing Docling task ID instead of submitting again", async () => {
        document.doclingTaskId = "existing-task-456";

        fetchSpy
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_status: "success",
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        status: "success",
                        document: {
                            md_content: markdown,
                        },
                    },
                }),
            );

        const result = await extractMarkdownFromPdf(
            document,
            pdfBuffer,
            document.fileName,
        );

        expect(result).toBe(markdown);

        // Only polling and result retrieval are necessary.
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        expect(fetchSpy.mock.calls[0][0]).toBe(
            "http://localhost:5001/v1/status/poll/existing-task-456",
        );

        expect(fetchSpy.mock.calls[1][0]).toBe(
            "http://localhost:5001/v1/result/existing-task-456",
        );

        // A new task must not be submitted.
        expect(fetchSpy).not.toHaveBeenCalledWith(
            "http://localhost:5001/v1/convert/file/async",
            expect.anything(),
        );

        expect(mockUpdateDocument).toHaveBeenCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.COMPLETED,
        });
    });

    // -------------------------------------------------------
    // 3. Permanent Docling failure
    // -------------------------------------------------------

    test("marks conversion FAILED when Docling reports a permanent failure", async () => {
        fetchSpy
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_id: "task-failed",
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_status: "failure",
                        failure: {
                            message: "Unsupported or corrupted PDF",
                            retryable: false,
                        },
                    },
                }),
            );

        await expect(
            extractMarkdownFromPdf(document, pdfBuffer, document.fileName),
        ).rejects.toBeInstanceOf(UnrecoverableError);

        // The original Markdown must never be uploaded.
        expect(mockUploadDocument).not.toHaveBeenCalled();

        // The final attempted state update should mark the conversion failed.
        expect(mockUpdateDocument).toHaveBeenLastCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.FAILED,
        });
    });

    // -------------------------------------------------------
    // 4. Transient failure
    // -------------------------------------------------------

    test("does not immediately mark conversion FAILED for a transient error", async () => {
        fetchSpy
            // Initial submission succeeds.
            .mockResolvedValueOnce(
                createResponse({
                    body: { task_id: "task-transient" },
                }),
            )
            // Polling fails repeatedly, exhausting the retry attempts.
            .mockRejectedValueOnce(new Error("Network temporarily unavailable"))
            .mockRejectedValueOnce(new Error("Network temporarily unavailable"))
            .mockRejectedValueOnce(new Error("Network temporarily unavailable"))
            .mockRejectedValueOnce(
                new Error("Network temporarily unavailable"),
            );

        await expect(
            extractMarkdownFromPdf(document, pdfBuffer, document.fileName),
        ).rejects.toThrow(
            "Docling polling failed after exhausting transient retries",
        );

        expect(mockUploadDocument).not.toHaveBeenCalled();

        expect(mockUpdateDocument).not.toHaveBeenCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.FAILED,
        });
    });

    // -------------------------------------------------------
    // 5. R2 upload failure
    // -------------------------------------------------------

    test("does not mark conversion COMPLETED when Markdown upload fails", async () => {
        createSuccessfulFetchSequence();

        mockUploadDocument.mockRejectedValueOnce(new Error("R2 upload failed"));

        await expect(
            extractMarkdownFromPdf(document, pdfBuffer, document.fileName),
        ).rejects.toThrow("R2 upload failed");

        expect(mockUploadDocument).toHaveBeenCalledTimes(1);

        // COMPLETED must not be persisted after a failed upload.
        expect(mockUpdateDocument).not.toHaveBeenCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.COMPLETED,
        });

        // The upload error is an ordinary Error, not UnrecoverableError.
        expect(mockUpdateDocument).not.toHaveBeenCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.FAILED,
        });
    });

    // -------------------------------------------------------
    // 6. Invalid storage key
    // -------------------------------------------------------

    test("marks conversion FAILED when the storage key does not end in original.pdf", async () => {
        document.storageKey = "users/user-123/documents/contract.pdf";

        fetchSpy
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_id: "task-invalid-key",
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    body: {
                        task_status: "success",
                    },
                }),
            );

        await expect(
            extractMarkdownFromPdf(document, pdfBuffer, document.fileName),
        ).rejects.toBeInstanceOf(UnrecoverableError);

        // Validation happens before fetching the Markdown result.
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        expect(mockUploadDocument).not.toHaveBeenCalled();

        expect(mockUpdateDocument).toHaveBeenLastCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.FAILED,
        });
    });

    // -------------------------------------------------------
    // 7. Missing document argument
    // -------------------------------------------------------

    test("throws when the document argument is missing", async () => {
        await expect(extractMarkdownFromPdf(null, pdfBuffer)).rejects.toThrow(
            "Document is required",
        );

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockUpdateDocument).not.toHaveBeenCalled();
        expect(mockUploadDocument).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------
    // 8. Database update retries
    // -------------------------------------------------------

    test("retries a transient database update failure", async () => {
        mockUpdateDocument
            .mockRejectedValueOnce(new Error("Temporary database error"))
            .mockImplementation(async (_documentId, updates) => ({
                ...document,
                ...updates,
            }));

        createSuccessfulFetchSequence();

        const result = await extractMarkdownFromPdf(
            document,
            pdfBuffer,
            document.fileName,
        );

        expect(result).toBe(markdown);

        // The first SUBMITTING update fails once, then succeeds.
        expect(mockUpdateDocument).toHaveBeenCalledTimes(4);

        expect(mockUpdateDocument).toHaveBeenNthCalledWith(1, document._id, {
            doclingConversionState: DocumentConversionStateEnum.SUBMITTING,
        });

        expect(mockUpdateDocument).toHaveBeenNthCalledWith(2, document._id, {
            doclingConversionState: DocumentConversionStateEnum.SUBMITTING,
        });

        expect(mockUpdateDocument).toHaveBeenLastCalledWith(document._id, {
            doclingConversionState: DocumentConversionStateEnum.COMPLETED,
        });
    });

    // -------------------------------------------------------
    // 9. Retry exhaustion
    // -------------------------------------------------------

    test("throws UnrecoverableError after exhausting database update retries", async () => {
        mockUpdateDocument.mockRejectedValue(new Error("Database unavailable"));

        await expect(
            extractMarkdownFromPdf(document, pdfBuffer, document.fileName),
        ).rejects.toBeInstanceOf(UnrecoverableError);

        // Three attempts are configured by updateDocumentWithRetry.
        expect(mockUpdateDocument).toHaveBeenCalledTimes(6);

        // The helper exhausts its three attempts for the SUBMITTING
        // update, then the catch block attempts to persist FAILED.
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockUploadDocument).not.toHaveBeenCalled();
    });
});
