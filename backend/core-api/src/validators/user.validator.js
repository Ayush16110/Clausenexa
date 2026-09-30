import { body } from "express-validator";

const updateUserValidator = () => [
    body("username")
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be between 3 and 30 characters")
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage(
            "Username can only contain letters, numbers, and underscores",
        ),

    body("fullName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Full name must be between 2 and 100 characters"),

    body().custom((body) => {
        const allowedFields = ["username", "fullName"];
        const receivedFields = Object.keys(body);

        const hasInvalidField = receivedFields.some(
            (field) => !allowedFields.includes(field),
        );

        if (hasInvalidField) {
            throw new Error("Only username and fullName can be updated");
        }

        if (receivedFields.length === 0) {
            throw new Error("At least one field is required");
        }

        return true;
    }),
];

export { updateUserValidator };
