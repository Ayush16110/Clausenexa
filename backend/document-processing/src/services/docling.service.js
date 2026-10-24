import env from "../config/env.js";
import { DocumentConversionStateEnum } from "../utils/document.constants.js";
import { updateDocument } from "./document.service.js";
import { UnrecoverableError } from "bullmq";
import { uploadDocument } from "./storage.service.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt, retryAfterHeader = null) => {
    if (retryAfterHeader) {
        const retryAfterSeconds = Number(retryAfterHeader);

        if (
            retryAfterHeader.trim() !== "" &&
            Number.isFinite(retryAfterSeconds) &&
            retryAfterSeconds >= 0
        ) {
            return retryAfterSeconds * 1000;
        }

        const retryAfterDate = Date.parse(retryAfterHeader);

        if (Number.isFinite(retryAfterDate)) {
            return Math.max(0, retryAfterDate - Date.now());
        }
    }

    return Math.min(500 * 2 ** (attempt - 1), 5000);
};

const submitDocumentForConversion = async (
    pdfBuffer,
    filename = "document.pdf",
) => {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        throw new Error("A non-empty PDF buffer is required");
    }

    const formData = new FormData();

    const pdfBlob = new Blob([pdfBuffer], {
        type: "application/pdf",
    });

    formData.append("files", pdfBlob, filename);
    formData.append("from_formats", "pdf");
    formData.append("to_formats", "md");
    formData.append("do_ocr", "false");
    formData.append("do_table_structure", "true");
    formData.append("do_pdf_heading_hierarchy", "true");
    formData.append("include_images", "false");

    const DOCLING_COVERT_URL = `${env.doclingBaseUrl}/v1/convert/file/async`;

    const response = await fetch(DOCLING_COVERT_URL, {
        method: "POST",
        headers: {
            accept: "application/json",
        },
        body: formData,
        signal: AbortSignal.timeout(env.doclingTimeoutMs),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            `Docling submission failed with status ${response.status}`,
        );
    }

    if (!result?.task_id) {
        throw new Error("Docling response did not contain a task_id");
    }

    return result.task_id;
};

const pollConversionTask = async (taskId) => {
    if (!taskId) {
        throw new UnrecoverableError("Docling task ID is required");
    }

    const deadline = Date.now() + env.doclingTimeoutMs;
    const maxRetries = 3;
    const requestTimeoutMs = 10_000;

    const DOCLING_POLL_URL = `${env.doclingBaseUrl}/v1/status/poll/${encodeURIComponent(taskId)}`;

    while (Date.now() < deadline) {
        let result;
        let attempt = 0;

        while (true) {
            const remainingMs = deadline - Date.now();

            if (remainingMs <= 0) {
                throw new Error("Docling conversion timed out while polling");
            }

            let response;

            try {
                response = await fetch(DOCLING_POLL_URL, {
                    headers: {
                        accept: "application/json",
                    },
                    signal: AbortSignal.timeout(
                        Math.min(remainingMs, requestTimeoutMs),
                    ),
                });
            } catch (cause) {
                if (Date.now() >= deadline) {
                    throw new Error(
                        "Docling conversion timed out while polling",
                        { cause },
                    );
                }

                if (attempt >= maxRetries) {
                    throw new Error(
                        "Docling polling failed after exhausting transient retries",
                        { cause },
                    );
                }

                attempt++;

                const delayMs = getRetryDelay(attempt);

                if (delayMs >= deadline - Date.now()) {
                    throw new Error(
                        "Docling conversion timed out while waiting to retry polling",
                        { cause },
                    );
                }

                await sleep(delayMs);
                continue;
            }

            if (
                response.status === 429 ||
                (response.status >= 500 && response.status <= 599)
            ) {
                if (attempt >= maxRetries) {
                    throw new Error(
                        `Docling polling failed with HTTP ${response.status} after exhausting transient retries`,
                    );
                }

                attempt++;

                const delayMs = getRetryDelay(
                    attempt,
                    response.status === 429
                        ? response.headers.get("retry-after")
                        : null,
                );

                if (delayMs >= deadline - Date.now()) {
                    throw new Error(
                        "Docling conversion timed out while waiting to retry polling",
                    );
                }

                await sleep(delayMs);
                continue;
            }

            if (!response.ok) {
                throw new UnrecoverableError(
                    `Docling status check failed with HTTP ${response.status}`,
                );
            }

            try {
                result = await response.json();
            } catch (cause) {
                throw new UnrecoverableError(
                    `Docling returned invalid JSON while polling: ${cause.message}`,
                );
            }

            if (!result || typeof result.task_status !== "string") {
                throw new UnrecoverableError(
                    "Docling returned an invalid status response",
                );
            }

            break;
        }

        switch (result.task_status) {
            case "success":
                return result;

            case "failure": {
                const message =
                    result.failure?.message ||
                    result.error_message ||
                    "Docling conversion failed";

                if (result.failure?.retryable === true) {
                    throw new Error(message);
                }

                throw new UnrecoverableError(message);
            }

            case "partial_success":
                throw new UnrecoverableError(
                    result.failure?.message ||
                        result.error_message ||
                        "Docling conversion completed partially",
                );

            case "skipped":
                throw new UnrecoverableError(
                    result.error_message || "Docling skipped the conversion",
                );

            case "pending":
            case "started":
                break;

            default:
                throw new UnrecoverableError(
                    `Unexpected Docling task status: ${result.task_status}`,
                );
        }

        const remainingMs = deadline - Date.now();

        if (remainingMs <= 0) {
            break;
        }

        await sleep(Math.min(env.doclingPollIntervalMs, remainingMs));
    }

    throw new Error("Docling conversion timed out");
};

const getConversionResult = async (taskId) => {
    if (!taskId) {
        throw new UnrecoverableError("Docling task ID is required");
    }

    const DOCLING_RESULT_URL = `${env.doclingBaseUrl}/v1/result/${encodeURIComponent(taskId)}`;

    let response;

    try {
        response = await fetch(DOCLING_RESULT_URL, {
            headers: {
                accept: "application/json",
            },
            signal: AbortSignal.timeout(10_000),
        });
    } catch (cause) {
        throw new Error(
            "Docling result retrieval failed due to a network error",
            { cause },
        );
    }

    if (
        response.status === 429 ||
        (response.status >= 500 && response.status <= 599)
    ) {
        throw new Error(
            `Docling result retrieval failed with HTTP ${response.status}`,
        );
    }

    if (!response.ok) {
        throw new UnrecoverableError(
            `Docling result retrieval failed with HTTP ${response.status}`,
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (cause) {
        throw new UnrecoverableError(
            `Docling returned invalid JSON for the conversion result: ${cause.message}`,
        );
    }

    if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new UnrecoverableError(
            "Docling returned an invalid conversion result",
        );
    }

    const status = result.status;

    if (
        status === "failure" ||
        result.kind === "TaskFailureResult" ||
        result.failure
    ) {
        const message =
            result.failure?.message ||
            result.error_message ||
            "Docling conversion failed";

        if (result.failure?.retryable === true) {
            throw new Error(message);
        }

        throw new UnrecoverableError(message);
    }

    if (status === "partial_success" || status === "skipped") {
        throw new UnrecoverableError(
            result.error_message ||
                `Docling conversion ended with status: ${status}`,
        );
    }

    if (status !== "success") {
        throw new UnrecoverableError(
            `Unexpected Docling result status: ${status}`,
        );
    }

    const markdown = result.document?.md_content;

    if (typeof markdown !== "string" || !markdown.trim()) {
        throw new UnrecoverableError(
            "Docling returned empty or invalid Markdown content",
        );
    }

    return markdown;
};

const updateDocumentWithRetry = async (
    documentId,
    updates,
    maxAttempts = 3,
) => {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const updatedDocument = await updateDocument(documentId, updates);

            if (!updatedDocument) {
                throw new UnrecoverableError(
                    `Document ${documentId} was not found or could not be updated`,
                );
            }

            return updatedDocument;
        } catch (error) {
            if (error instanceof UnrecoverableError) {
                throw error;
            }

            lastError = error;

            if (attempt === maxAttempts) {
                break;
            }

            const delayMs = 250 * 2 ** (attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    const error = new UnrecoverableError(
        `Failed to update document ${documentId} after ${maxAttempts} attempts.`,
    );

    error.phase = "document_update";
    error.retryable = false;
    error.documentId = documentId;
    error.cause = lastError;

    throw error;
};

const extractMarkdownFromPdf = async (
    document,
    pdfBuffer,
    filename = "document.pdf",
) => {
    if (!document) {
        throw new Error("Document is required");
    }

    try {
        let taskId = document.doclingTaskId;

        if (!taskId) {
            document = await updateDocumentWithRetry(document._id, {
                doclingConversionState: DocumentConversionStateEnum.SUBMITTING,
            });

            taskId = await submitDocumentForConversion(pdfBuffer, filename);

            if (!taskId) {
                throw new Error(
                    "Submission to Docling failed or task ID is missing",
                );
            }

            document = await updateDocumentWithRetry(document._id, {
                doclingTaskId: taskId,
                doclingConversionState: DocumentConversionStateEnum.SUBMITTED,
            });
        }

        await pollConversionTask(taskId);

        if (!document.storageKey?.endsWith("original.pdf")) {
            throw new UnrecoverableError(
                "Document storage key must end with original.pdf",
            );
        }

        const storageKey = document.storageKey.replace(
            "original.pdf",
            "original.md",
        );

        const markdown = await getConversionResult(taskId);

        await uploadDocument(
            storageKey,
            markdown,
            "text/markdown; charset=utf-8",
        );

        await updateDocumentWithRetry(document._id, {
            doclingConversionState: DocumentConversionStateEnum.COMPLETED,
        });

        return markdown;
    } catch (error) {
        if (error instanceof UnrecoverableError) {
            try {
                await updateDocumentWithRetry(document._id, {
                    doclingConversionState: DocumentConversionStateEnum.FAILED,
                });
            } catch (updateError) {
                console.error(
                    `Failed to persist Docling failure state for document ${document._id}:`,
                    updateError.message,
                );
            }
        }

        throw error;
    }
};

export { extractMarkdownFromPdf };
