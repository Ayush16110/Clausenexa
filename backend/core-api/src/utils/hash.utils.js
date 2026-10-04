import crypto from "crypto";

const generateFileHash = (buffer) => {
    return crypto.createHash("sha256").update(buffer).digest("hex");
};

export { generateFileHash };
