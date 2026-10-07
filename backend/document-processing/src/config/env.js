import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

const env = {
    port: process.env.PORT,
}

export default env;