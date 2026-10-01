import { body } from "express-validator";

const createContractValidator = () => [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ max: 150 })
        .withMessage("Title must be less than 150 characters"),

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

export { createContractValidator };
