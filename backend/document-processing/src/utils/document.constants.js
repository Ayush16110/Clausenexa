export const DocumentProcessingStatusEnum = {
    QUEUED: "queued",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
};

export const AvailableDocumentProcessingStatus = Object.values(
    DocumentProcessingStatusEnum,
);

export const DocumentProcessingStageEnum = {
    QUEUED: "queued",
    EXTRACTING: "extracting",
    CHUNKING: "chunking",
    EMBEDDING: "embedding",
    STORING_VECTORS: "storing_vectors",
    COMPLETED: "completed",
};

export const AvailableDocumentProcessingStage = Object.values(
    DocumentProcessingStageEnum,
);
