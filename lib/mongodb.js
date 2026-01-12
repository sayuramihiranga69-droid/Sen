// mongoConnect.js
const mongoose = require("mongoose");
const EnvVar = require("./mongodbenv"); // MongoDB model for env variables

// Default environment variables to insert if they don't exist
const defaultEnvVariables = [
  {
    key: "ALIVE_IMG",
    value: "https://files.catbox.moe/d0v6fe.png"
  },
  {
    key: "ALIVE_MSG",
    value: "Hello 👋 I am SAYURA MD, made by SAYURAMIHIRANGA al 🪀"
  },
  {
    key: "PREFIX",
    value: "."
  }
];

// Hardcoded MongoDB URI
const MONGODB_URI = "mongodb://mongo:CfffUCVKyrOgnsLnEFernUcAlrTeiiDG@trolley.proxy.rlwy.net:20937";

const connectDB = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("❌ MongoDB URI is missing!");
    }

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);

    console.log("🛜 MongoDB Connected ✅");

    // Insert default env vars if they don't exist
    for (const envVar of defaultEnvVariables) {
      const existingVar = await EnvVar.findOne({ key: envVar.key });
      if (!existingVar) {
        await EnvVar.create(envVar);
        console.log(`➕ Created default env var: ${envVar.key}`);
      }
    }

    console.log("🌟 Default environment variables checked/created.");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
