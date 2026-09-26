import { body } from "express-validator";

const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid")
            .normalizeEmail(),

        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLength({ min: 3, max: 30 })
            .withMessage("Username must be between 3 and 30 characters")
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage(
                "Username can only contain letters, numbers, and underscores",
            ),

        body("password")
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 8, max: 128 })
            .withMessage("Password must be between 8 and 128 characters"),

        body("fullName")
            .trim()
            .notEmpty()
            .withMessage("Full name is required")
            .isLength({ min: 2, max: 100 })
            .withMessage("Full name must be between 2 and 100 characters"),
    ];
};

const userLoginValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid")
            .normalizeEmail(),
        body("password").notEmpty().withMessage("Password is required"),
    ];
};

const resendEmailVerificationValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid")
            .normalizeEmail(),
    ];
};

export {
    userRegisterValidator,
    userLoginValidator,
    resendEmailVerificationValidator,
};
