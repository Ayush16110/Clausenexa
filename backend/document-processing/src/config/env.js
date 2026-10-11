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
};

export default env;
