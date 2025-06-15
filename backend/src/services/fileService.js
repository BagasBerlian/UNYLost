const sharp = require("sharp");
const { google } = require("googleapis");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const logger = require("../utils/logger");

class FileService {
  constructor() {
    this.driveService = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    this.imageQuality = 85;
    this.maxImageWidth = 1920;
    this.maxImageHeight = 1920;

    this.initializeDriveService();
  }

  /**
   * Initialize Google Drive service
   */
  async initializeDriveService() {
    try {
      const credentialsPath =
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
        "./config/serviceAccountKey.json";

      // Check if credentials file exists
      try {
        await fs.access(credentialsPath);
      } catch (error) {
        logger.warn(
          "Google Drive credentials not found, file uploads will be disabled"
        );
        return;
      }

      const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      this.driveService = google.drive({ version: "v3", auth });

      // Test connection
      await this.testDriveConnection();
      logger.info("✅ Google Drive service initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize Google Drive service:", error);
    }
  }

  /**
   * Test Google Drive connection
   */
  async testDriveConnection() {
    try {
      if (!this.driveService) return false;

      const response = await this.driveService.files.list({
        pageSize: 1,
        fields: "files(id, name)",
      });

      return response.status === 200;
    } catch (error) {
      logger.error("Google Drive connection test failed:", error);
      return false;
    }
  }

  /**
   * Upload image file
   */
  async uploadImage(file, category = "general") {
    try {
      // Validate file
      this.validateFile(file);

      // Process image
      const processedImage = await this.processImage(file.buffer);

      // Generate filename
      const filename = this.generateFilename(file.originalname, category);

      // Upload to Google Drive
      if (this.driveService) {
        return await this.uploadToDrive(
          processedImage,
          filename,
          file.mimetype
        );
      } else {
        // Fallback to local storage
        return await this.uploadToLocal(processedImage, filename);
      }
    } catch (error) {
      logger.error("Upload image error:", error);
      throw error;
    }
  }

  /**
   * Upload multiple images
   */
  async uploadImages(files, category = "general") {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadImage(file, category)
      );
      const results = await Promise.allSettled(uploadPromises);

      const urls = [];
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          urls.push(result.value);
        } else {
          errors.push({
            file: files[index].originalname,
            error: result.reason.message,
          });
        }
      });

      if (errors.length > 0) {
        logger.warn("Some files failed to upload:", errors);
      }

      return { urls, errors };
    } catch (error) {
      logger.error("Upload multiple images error:", error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(file) {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new Error(
        `File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`
      );
    }

    // Check mime type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error("Invalid file type. Only images are allowed");
    }

    // Check if file has buffer
    if (!file.buffer) {
      throw new Error("Invalid file data");
    }
  }

  /**
   * Process image (resize, compress, optimize)
   */
  async processImage(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Calculate resize dimensions
      let { width, height } = metadata;
      const needsResize =
        width > this.maxImageWidth || height > this.maxImageHeight;

      if (needsResize) {
        const ratio = Math.min(
          this.maxImageWidth / width,
          this.maxImageHeight / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Process image
      let processedImage = image;

      if (needsResize) {
        processedImage = processedImage.resize(width, height, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG and compress
      const result = await processedImage
        .jpeg({
          quality: this.imageQuality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();

      logger.info(
        `Image processed: ${metadata.width}x${metadata.height} -> ${width}x${height}, size: ${buffer.length} -> ${result.length} bytes`
      );

      return result;
    } catch (error) {
      logger.error("Image processing error:", error);
      throw new Error("Failed to process image");
    }
  }

  /**
   * Generate unique filename
   */
  generateFilename(originalName, category) {
    const ext = path.extname(originalName) || ".jpg";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const uuid = uuidv4().substring(0, 8);
    return `${category}_${timestamp}_${uuid}${ext}`;
  }

  /**
   * Upload to Google Drive
   */
  async uploadToDrive(buffer, filename, mimeType) {
    try {
      const fileMetadata = {
        name: filename,
        parents: this.folderId ? [this.folderId] : undefined,
      };

      const media = {
        mimeType: mimeType || "image/jpeg",
        body: require("stream").Readable.from(buffer),
      };

      const response = await this.driveService.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id,name,webViewLink",
      });

      const fileId = response.data.id;

      // Make file publicly accessible
      await this.driveService.permissions.create({
        fileId: fileId,
        resource: {
          role: "reader",
          type: "anyone",
        },
      });

      // Generate direct download URL
      const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

      logger.info(`File uploaded to Google Drive: ${filename} (${fileId})`);

      return downloadUrl;
    } catch (error) {
      logger.error("Google Drive upload error:", error);
      throw new Error("Failed to upload to Google Drive");
    }
  }

  /**
   * Upload to local storage (fallback)
   */
  async uploadToLocal(buffer, filename) {
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");

      // Ensure uploads directory exists
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      const baseUrl = process.env.BASE_URL || "http://localhost:5000";
      const fileUrl = `${baseUrl}/uploads/${filename}`;

      logger.info(`File uploaded locally: ${filename}`);

      return fileUrl;
    } catch (error) {
      logger.error("Local upload error:", error);
      throw new Error("Failed to upload file locally");
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFromDrive(fileId) {
    try {
      if (!this.driveService) return false;

      await this.driveService.files.delete({ fileId });
      logger.info(`File deleted from Google Drive: ${fileId}`);

      return true;
    } catch (error) {
      logger.error("Delete from Google Drive error:", error);
      return false;
    }
  }

  /**
   * Delete file from local storage
   */
  async deleteFromLocal(filename) {
    try {
      const filePath = path.join(process.cwd(), "uploads", filename);
      await fs.unlink(filePath);
      logger.info(`File deleted locally: ${filename}`);

      return true;
    } catch (error) {
      logger.error("Delete local file error:", error);
      return false;
    }
  }

  /**
   * Extract file ID from Google Drive URL
   */
  extractFileIdFromUrl(url) {
    const patterns = [
      /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Get file info from Google Drive
   */
  async getFileInfo(fileId) {
    try {
      if (!this.driveService) return null;

      const response = await this.driveService.files.get({
        fileId,
        fields: "id,name,size,createdTime,mimeType,webViewLink",
      });

      return response.data;
    } catch (error) {
      logger.error("Get file info error:", error);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      driveConnected: !!this.driveService,
      folderId: this.folderId,
      maxFileSize: this.maxFileSize,
      allowedMimeTypes: this.allowedMimeTypes,
      imageSettings: {
        quality: this.imageQuality,
        maxWidth: this.maxImageWidth,
        maxHeight: this.maxImageHeight,
      },
    };
  }

  /**
   * Clean up old local files
   */
  async cleanupLocalFiles(maxAge = 7 * 24 * 60 * 60 * 1000) {
    // 7 days
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");

      try {
        const files = await fs.readdir(uploadsDir);
        const now = Date.now();
        let deletedCount = 0;

        for (const file of files) {
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }

        logger.info(`Cleaned up ${deletedCount} old files`);
        return deletedCount;
      } catch (error) {
        logger.warn("Cleanup local files error:", error);
        return 0;
      }
    } catch (error) {
      logger.error("Cleanup error:", error);
      return 0;
    }
  }
}

// Export singleton instance
module.exports = { FileService: new FileService() };
