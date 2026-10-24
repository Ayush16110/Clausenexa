import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { processDocument } from "../services/document-processing.service.js";
import { updateDocument } from "../services/document.service.js";
import { DocumentProcessingStatusEnum } from "../utils/document.constants.js";

const documentProcessingWorker = new Worker(
    "document-processing",
    async (job) => {
        const { documentId } = job.data;

        console.log(`Processing document: ${documentId}`);
        console.log(`Job ID: ${job.id}`);

        return await processDocument(documentId);
    },
    {
        connection: redisConnection,
    },
);

documentProcessingWorker.on("error", (error) => {
    console.error("Unexpected worker error encountered:", error);
});

documentProcessingWorker.on("failed", async (job, error) => {
    if (!job) return;

    const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    const isUnrecoverable = error.name === "UnrecoverableError";

    if (!attemptsExhausted && !isUnrecoverable) {
        console.warn(
            `Job ${job.id} failed. Retrying (${job.attemptsMade}/${job.opts.attempts}):`,
            error.message,
        );
        return;
    }

    console.error(`Job ${job.id} permanently failed:`, error.message);

    try {
        const updatedDocument = await updateDocument(job.data.documentId, {
            processingStatus: DocumentProcessingStatusEnum.FAILED,
            processingError: error.message,
        });

        if (!updatedDocument) {
            console.error(
                `Could not update failure state: document ${job.data.documentId} was not found or was deleted.`,
            );
        }
    } catch (updateError) {
        console.error(
            `Failed to persist document failure state for job ${job.id}:`,
            updateError.message,
        );
    }
});

export { documentProcessingWorker };
