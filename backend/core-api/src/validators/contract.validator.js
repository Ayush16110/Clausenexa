import { body } from "express-validator";

const createContractValidator = () => [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 2, max: 150 })
        .withMessage("Title must be between 2 and 150 characters"),

    body().custom((body) => {
        const allowedFields = ["title"];
        const receivedFields = Object.keys(body);

        const hasInvalidField = receivedFields.some(
            (field) => !allowedFields.includes(field),
        );

        if (hasInvalidField) {
            throw new Error("Only title can be provided");
        }

        return true;
    }),
];

const updateContractValidator = () => [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 2, max: 150 })
        .withMessage("Title must be between 2 and 150 characters"),

    body().custom((body) => {
        const allowedFields = ["title"];
        const receivedFields = Object.keys(body);

        const hasInvalidField = receivedFields.some(
            (field) => !allowedFields.includes(field),
        );

        if (hasInvalidField) {
            throw new Error("Only title can be updated");
        }

        return true;
    }),
];

export { createContractValidator, updateContractValidator };
