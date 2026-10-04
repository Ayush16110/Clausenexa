import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

const env = {
    port: process.env.PORT || 5000,
    corsOrigin: process.env.CORS_ORIGIN,
    mongoUri: process.env.MONGODB_URI,
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY,
    mailtrapHost: process.env.MAILTRAP_HOST,
    mailtrapPort: process.env.MAILTRAP_PORT,
    mailtrapUser: process.env.MAILTRAP_USER,
    mailtrapPass: process.env.MAILTRAP_PASS,
    mailtrapFrom: process.env.MAILTRAP_FROM,
    mailtrapName: process.env.MAILTRAP_NAME,
    clientUrl: process.env.CLIENT_URL,
    nodeEnv: process.env.NODE_ENV || "development",
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    documentProcessingServiceUrl: process.env.DOCUMENT_PROCESSING_SERVICE_URL,
};

export default env;
