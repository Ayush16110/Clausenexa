import env from "../config/env.js";

const createProcessingJob = async (documentId) => {
    if (!documentId) {
        throw new Error("Document ID is required");
    }

    try {
        const response = await fetch(
            `${env.documentProcessingServiceUrl}/internal/v1/jobs`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    documentId,
                }),
            },
        );

        if (!response.ok) {
            throw new Error("Failed to create document processing job");
        }

        const { jobId } = await response.json();

        return { jobId };
    } catch (error) {
        throw error;
    }
};

export { createProcessingJob };
