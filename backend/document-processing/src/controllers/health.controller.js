import mongoose from "mongoose";
import env from "../config/env.js";
import { checkStorageConnection } from "../services/storage.service.js";

const checkMongoDB = async () => {
    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB is not connected");
    }

    return true;
};

const checkDocling = async () => {
    const response = await fetch(`${env.doclingBaseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
        throw new Error(`Docling returned HTTP ${response.status}`);
    }

    return true;
};

const checkDependency = async (check) => {
    try {
        await check();

        return "ok";
    } catch {
        return "error";
    }
};

const getHealth = (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "document-processing",
        timestamp: new Date().toISOString(),
    });
};

const getReadiness = async (req, res) => {
    const [mongoDB, storage, docling] = await Promise.all([
        checkDependency(checkMongoDB),
        checkDependency(checkStorageConnection),
        checkDependency(checkDocling),
    ]);

    const dependencies = {
        mongodb: mongoDB,
        storage,
        docling,
    };

    const isReady = Object.values(dependencies).every(
        (status) => status === "ok",
    );

    return res.status(isReady ? 200 : 503).json({
        status: isReady ? "ready" : "not_ready",
        service: "document-processing",
        timestamp: new Date().toISOString(),
        dependencies,
    });
};

export { getHealth, getReadiness };
