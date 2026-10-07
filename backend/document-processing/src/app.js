import express from "express";

const app = express();

app.use(express.json({ limit: "16kb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    }),
);

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "document-processing",
    });
});

export { app };