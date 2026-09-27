import Mailgen from "mailgen";
import env from "../config/env.js";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: env.mailtrapHost,
        port: env.mailtrapPort,
        auth: {
            user: env.mailtrapUser,
            pass: env.mailtrapPass,
        },
    });

    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: env.mailtrapName,
            link: env.clientUrl,
        },
    });

    const emailPlainText = mailGenerator.generatePlaintext(
        options.mailGenContent,
    );
    const emailHTML = mailGenerator.generate(options.mailGenContent);

    const mail = {
        from: env.mailtrapFrom,
        to: options.email,
        subject: options.subject,
        text: emailPlainText,
        html: emailHTML,
    };

    try {
        await transporter.sendMail(mail);
    } catch (error) {
        console.error("Email service failed:", error);
        throw error;
    }
};

const emailVerificationMailGenContent = (username, verificationLink) => {
    return {
        body: {
            name: username,
            intro: "Welcome to ClauseNexa! We're very excited to have you on board.",
            action: {
                instructions:
                    "Please verify your email address to activate your ClauseNexa account.",
                button: {
                    color: "#2563EB",
                    text: "Verify Email Address",
                    link: verificationLink,
                },
            },
            outro: "If you did not create a ClauseNexa account, you can safely ignore this email.",
        },
    };
};

const forgotPasswordMailGenContent = (username, resetLink) => {
    return {
        body: {
            name: username,
            intro: "We received a request to reset your ClauseNexa account password.",
            action: {
                instructions:
                    "Click the button below to reset your password. This link will expire in 10 minutes.",
                button: {
                    color: "#2563EB",
                    text: "Reset Password",
                    link: resetLink,
                },
            },
            outro: "If you did not request a password reset, you can safely ignore this email.",
        },
    };
};

export {
    sendEmail,
    emailVerificationMailGenContent,
    forgotPasswordMailGenContent,
};
