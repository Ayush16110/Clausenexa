const validatePdfBuffer = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Invalid PDF buffer");
    }

    const header = buffer.subarray(0, 1024).toString("latin1");

    if (!header.startsWith("%PDF-")) {
        throw new Error("Invalid PDF header");
    }

    return true;
};

export { validatePdfBuffer };
