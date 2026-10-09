import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { processDocument } from "../services/document-processing.service.js";

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

export { documentProcessingWorker };
