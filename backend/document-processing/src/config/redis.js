import { Redis } from "ioredis";
import env from "./env.js";

const redisConnection = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
    console.log("Redis connected successfully");
});

redisConnection.on("error", (error) => {
    console.error("Redis connection error:", error.message);
});

export { redisConnection };
