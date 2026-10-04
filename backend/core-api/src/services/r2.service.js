import {
    S3Client,
    HeadBucketCommand,
    PutObjectCommand,
    DeleteObjectCommand,
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

const checkR2Health = async () => {
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

const uploadToR2 = async ({ buffer, storageKey, mimeType }) => {
    try {
        await r2Client.send(
            new PutObjectCommand({
                Bucket: env.r2BucketName,
                Key: storageKey,
                Body: buffer,
                ContentType: mimeType,
            }),
        );

        return storageKey;
    } catch (error) {
        console.error("R2 upload failed:", error);
        throw error;
    }
};

const deleteFromR2 = async (storageKey) => {
    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: env.r2BucketName,
                Key: storageKey,
            }),
        );
    } catch (error) {
        console.error("R2 delete failed:", error);
        throw error;
    }
};

export { checkR2Health, uploadToR2, deleteFromR2 };
