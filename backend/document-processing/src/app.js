import express from "express";
import errorMiddleware from "./middlewares/error.middleware.js";
import requestLogger from "./middlewares/requestLogger.middleware.js";
import jobRouter from "./routes/job.routes.js";

const app = express();

app.use(express.json({ limit: "16kb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    }),
);

app.use(requestLogger);

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "document-processing",
        timestamp: new Date().toISOString(),
    });
});

app.use("/internal/v1/jobs", jobRouter);

app.use(errorMiddleware);

export default app;
