import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

const env = {
    port: process.env.PORT,
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL,
};

export default env;
