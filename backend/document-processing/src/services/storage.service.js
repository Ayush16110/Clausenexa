import {
    HeadBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import env from "../config/env.js";

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
    },
});

const checkStorageConnection = async () => {
    try {
        await r2Client.send(
            new HeadBucketCommand({
                Bucket: env.r2BucketName,
            }),
        );
        return true;
    } catch (error) {
        console.error("R2 health check failed: ", error);
        return false;
    }
};

const downloadDocument = async (storageKey) => {
    if (!storageKey) {
        throw new Error("Storage key is required");
    }

    const response = await r2Client.send(
        new GetObjectCommand({
            Bucket: env.r2BucketName,
            Key: storageKey,
        }),
    );

    if (!response.Body) {
        throw new Error("Document download returned an empty response");
    }

    return response.Body.transformToByteArray().then((bytes) =>
        Buffer.from(bytes),
    );
};

const uploadDocument = async (
    storageKey,
    content,
    contentType = "application/octet-stream",
) => {
    if (!storageKey) {
        throw new Error("Storage key is required");
    }

    if (
        content === undefined ||
        content === null ||
        (typeof content === "string" && !content.trim()) ||
        (Buffer.isBuffer(content) && content.length === 0)
    ) {
        throw new Error("Content is required");
    }

    await r2Client.send(
        new PutObjectCommand({
            Bucket: env.r2BucketName,
            Key: storageKey,
            Body: content,
            ContentType: contentType,
        }),
    );

    return storageKey;
};

export { downloadDocument, uploadDocument, checkStorageConnection };
