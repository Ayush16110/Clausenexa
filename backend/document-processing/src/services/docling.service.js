import env from "../config/env.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        throw new Error("Task ID is required");
    }

    const deadline = Date.now() + env.doclingTimeoutMs;
    const DOCLING_POLL_URL = `${env.doclingBaseUrl}/v1/status/poll/${encodeURIComponent(taskId)}`;

    while (Date.now() < deadline) {
        const remainingMs = deadline - Date.now();

        const response = await fetch(DOCLING_POLL_URL, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(Math.min(remainingMs, 10_000)),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                `Docling status check failed with HTTP ${response.status}`,
            );
        }

        if (!result || typeof result.task_status !== "string") {
            throw new Error(`Docling returned an invalid response`);
        }

        switch (result.task_status) {
            case "success":
                return;

            case "failure": {
                const message =
                    result.failure?.message ||
                    result.error_message ||
                    "Docling conversion failed";

                const error = new Error(message);

                error.retryable = result.failure?.retryable ?? false;
                error.category = result.failure?.category;
                error.phase = result.failure?.phase;

                throw error;
            }

            case "partial_success":
                throw new Error(
                    result.failure?.message ||
                        result.error_message ||
                        "Docling conversion completed partially",
                );

            case "skipped":
                throw new Error(
                    result.error_message || "Docling skipped the conversion",
                );

            case "pending":
            case "started":
                break;

            default:
                throw new Error(
                    `Unexpected Docling task status: ${result.task_status}`,
                );
        }

        const delay = Math.min(env.doclingPollIntervalMs, remainingMs);

        if (delay > 0) {
            await sleep(delay);
        }
    }

    throw new Error("Docling conversion timed out");
};

const getConversionResult = async (taskId) => {
    if (!taskId) {
        throw new Error("Docling task ID is required");
    }

    const DOCLING_RESULT_URL = `${env.doclingBaseUrl}/v1/result/${taskId}`;

    const response = await fetch(DOCLING_RESULT_URL, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            `Docling result retrieval failed with HTTP ${response.status}`,
        );
    }

    if (result?.kind === "TaskFailureResult" || result?.failure) {
        throw new Error(result.failure?.message || "Docling conversion failed");
    }

    const markdown = result?.document?.md_content;

    if (typeof markdown !== "string" || !markdown.trim()) {
        throw new Error("Docling returned empty or invalid Markdown content");
    }

    return markdown;
};

const extractMarkdownFromPdf = async (pdfBuffer, filename = "document.pdf") => {
    const taskId = await submitDocumentForConversion(pdfBuffer, filename);
    await pollConversionTask(taskId);
    return getConversionResult(taskId);
};

export {
    submitDocumentForConversion,
    pollConversionTask,
    getConversionResult,
    extractMarkdownFromPdf,
};
