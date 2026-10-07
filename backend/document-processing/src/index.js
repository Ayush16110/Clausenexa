import { app } from "./app.js";
import env from "./config/env.js";

const PORT = env.port || 8000;

app.listen(PORT, () => {
    console.log(`Document Processing Service running on port ${PORT}`);
});