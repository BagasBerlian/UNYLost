const express = require("express");
const router = express.Router();
const AIService = require("../../services/ai.service");
const FileService = require("../../services/file.service");
const multer = require("multer");

// Import route files
const authRoutes = require("./auth.routes");
const itemRoutes = require("./item.routes");
const matchRoutes = require("./match.routes");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Use route files
router.use("/auth", authRoutes);
router.use("/items", itemRoutes);
router.use("/matches", matchRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ai-health", async (req, res) => {
  try {
    const aiHealth = await AIService.healthCheck();
    res.status(200).json({
      status: "ok",
      ai_service: aiHealth,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Tidak dapat terhubung ke AI Layer",
      error: error.message,
    });
  }
});

router.get("/storage-status", async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      storage: {
        type: FileService.drive ? "Google Drive" : "Local",
        status: FileService.drive ? "Connected" : "Not Connected",
        folderId: FileService.folderId || "N/A",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get storage status",
      error: error.message,
    });
  }
});

router.post("/debug/upload-test", upload.single("file"), async (req, res) => {
  try {
    const FileService = require("../../services/file.service");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Coba upload ke Google Drive
    const fileUrl = await FileService.uploadToGoogleDrive(req.file);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      fileUrl,
    });
  } catch (error) {
    console.error("Error in upload test:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload file",
      error: error.message,
    });
  }
});

module.exports = router;
