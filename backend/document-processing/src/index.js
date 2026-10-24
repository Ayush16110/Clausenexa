import app from "./app.js";
import connectDB from "./db/mongo.js";
import env from "./config/env.js";

const port = env.port;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(port, () => {
            console.log(
                `⚡️[server]: Server is running at http://localhost:${port}`,
            );
        });

        // Initialize the worker only after MongoDB connects.
        await import("./workers/document-processing.worker.js");
    } catch (error) {
        console.error("❌ Service startup error:", error);
        process.exit(1);
    }
};

startServer();
