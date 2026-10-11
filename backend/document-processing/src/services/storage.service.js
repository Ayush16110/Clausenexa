import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import env from "../config/env.js";

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
    },
});

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

export { downloadDocument };
