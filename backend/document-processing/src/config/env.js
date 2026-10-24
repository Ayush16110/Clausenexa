import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

const env = {
    port: process.env.PORT,
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    doclingBaseUrl: process.env.DOCLING_BASE_URL || "http://localhost:5001",
    doclingPollIntervalMs: Number(process.env.DOCLING_POLL_INTERVAL_MS || 2000),
    doclingTimeoutMs: Number(process.env.DOCLING_TIMEOUT_MS || 600000),
};

export default env;
