import mongoose from "mongoose";
import env from "../config/env.js";

const connectDB = async () => {
    try {
        await mongoose.connect(env.mongoUri);
        console.log("✅ Connected to MongoDB");
    } catch (error) {
        console.error("❌ DB connection error:", error);
        throw error;
    }
};

export default connectDB;
