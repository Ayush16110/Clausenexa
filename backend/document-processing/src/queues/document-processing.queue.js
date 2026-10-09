import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

const documentProcessingQueue = new Queue("document-processing", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 4,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

export { documentProcessingQueue };
