import { PDFDocument } from "pdf-lib";

const getPdfPageCount = async (buffer) => {
    let pdf;

    try {
        pdf = await PDFDocument.load(buffer);
    } catch {
        const error = new Error("Invalid or unreadable PDF");
        error.statusCode = 400;
        throw error;
    }

    return pdf.getPageCount();
};

export { getPdfPageCount };
