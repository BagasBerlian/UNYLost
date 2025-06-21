require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  AI_LAYER_URL: process.env.AI_LAYER_URL || "http://localhost:8000/api",
  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
  STORAGE_TYPE: process.env.STORAGE_TYPE || "google_drive",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
};
