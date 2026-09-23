import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import requestLogger from "./middlewares/requestLogger.middleware.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import healthCheckRoute from "./routes/healthCheck.route.js";

const app = express();

// Basic configurations
app.use(express.json({ limit: "16kb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    }),
);

app.use(express.static("public"));

// CORS configuration
const allowedOrigins = env.corsOrigin
    ?.split(",")
    .map((origin) => origin.trim()) || ["http://localhost:5173"];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

// Cookie parser
app.use(cookieParser());

// Logger Middleware
app.use(requestLogger);

// Routes
app.use("/api/v1/healthCheck", healthCheckRoute);

// error handling Middleware
app.use(errorMiddleware);

export default app;
