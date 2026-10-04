import multer from "multer";
import { ApiError } from "../utils/api-error.js";

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new ApiError(400, "Only PDF files are allowed"));
        }

        cb(null, true);
    },
});

const uploadDocument = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return next(new ApiError(413, "File size cannot exceed 25 MB"));
            }

            return next(new ApiError(400, "Invalid file upload"));
        }

        if (err) {
            return next(err);
        }

        next();
    });
};

export { uploadDocument };
