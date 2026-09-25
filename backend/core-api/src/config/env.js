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
};

export default env;
