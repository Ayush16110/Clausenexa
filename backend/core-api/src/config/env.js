import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

const env = {
    port: process.env.PORT || 5000,
    corsOrigin: process.env.CORS_ORIGIN,
    mongoUri: process.env.MONGODB_URI,
};

export default env;
