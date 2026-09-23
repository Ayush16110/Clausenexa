import app from "./app.js";
import connectDB from "./db/mongo.js";
import env from "./config/env.js";

const port = env.port;

connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(
                `⚡️[server]: Server is running at http://localhost:${port}`,
            );
        });
    })
    .catch((error) => {
        console.error("❌DB connection error: ", error);
        process.exit(1);
    });
