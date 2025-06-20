require("dotenv").config;
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { google } = require("googleapis");
const config = require("../config/app");
const { bufferToStream } = require("../utils/stream-utils");

class FileService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), config.UPLOAD_DIR);

    // Buat direktori upload jika belum ada (untuk fallback)
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Setup Google Drive API
    this.drive = null;
    this.folderId = null;
    this.folderIds = {};
    this.initGoogleDrive();
  }

  async initGoogleDrive() {
    try {
      const credentialsPath = path.join(
        process.cwd(),
        "config",
        "google-credentials.json"
      );

      if (!fs.existsSync(credentialsPath)) {
        console.warn(
          "Google Drive credentials not found. Falling back to local storage."
        );
        return;
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      this.drive = google.drive({ version: "v3", auth });
      console.log("Google Drive API initialized successfully");

      // Cari atau buat folder UNYLost
      this.folderId = await this.findOrCreateFolder("UNYLost");
      console.log(`Using root Google Drive folder with ID: ${this.folderId}`);

      if (this.folderId) {
        // Bagikan folder UNYLost dengan akun email Anda
        await this.drive.permissions.create({
          fileId: this.folderId,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: process.env.EMAIL_USER,
          },
        });
        console.log(
          `Folder UNYLost dibagikan dengan ${process.env.EMAIL_USER}`
        );
      }

      // Buat struktur folder
      await this.setupFolderStructure();
    } catch (error) {
      console.error("Error initializing Google Drive:", error);
      console.warn("Falling back to local storage");
    }
  }

  async setupFolderStructure() {
    try {
      // Buat folder kategori
      const categories = ["lost_items", "found_items", "claims", "profiles"];

      for (const category of categories) {
        this.folderIds[category] = await this.findOrCreateFolder(
          category,
          this.folderId
        );
        console.log(
          `Created/found ${category} folder with ID: ${this.folderIds[category]}`
        );

        // Untuk item, buat subfolder berdasarkan kategori item
        if (category === "lost_items" || category === "found_items") {
          const itemCategories = [
            "electronics",
            "documents",
            "clothing",
            "accessories",
            "others",
          ];

          for (const itemCategory of itemCategories) {
            const categoryFolderId = await this.findOrCreateFolder(
              itemCategory,
              this.folderIds[category]
            );
            this.folderIds[`${category}_${itemCategory}`] = categoryFolderId;
            console.log(
              `Created/found ${category}_${itemCategory} folder with ID: ${categoryFolderId}`
            );
          }
        }
      }

      // Buat folder berdasarkan tanggal (tahun/bulan)
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");

      // Buat folder tahun jika belum ada
      const yearFolderId = await this.findOrCreateFolder(year, this.folderId);

      // Buat folder bulan jika belum ada
      const monthFolderId = await this.findOrCreateFolder(
        `${year}-${month}`,
        yearFolderId
      );

      this.folderIds["current_month"] = monthFolderId;
    } catch (error) {
      console.error("Error setting up folder structure:", error);
    }
  }

  async findOrCreateFolder(folderName, parentFolderId = null) {
    try {
      // Buat query pencarian folder
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      // Jika ada parent folder, tambahkan ke query
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      // Cari folder yang sudah ada
      const response = await this.drive.files.list({
        q: query,
        fields: "files(id, name)",
      });

      if (response.data.files.length > 0) {
        console.log(`Found existing folder: ${folderName}`);
        return response.data.files[0].id;
      }

      // Buat folder baru jika tidak ditemukan
      console.log(`Creating new folder: ${folderName}`);
      const fileMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      };

      // Jika ada parent folder, tambahkan
      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const folder = await this.drive.files.create({
        resource: fileMetadata,
        fields: "id",
      });

      // Set permission agar dapat diakses publik
      await this.ensureFolderPermission(folder.data.id);

      return folder.data.id;
    } catch (error) {
      console.error("Error finding or creating folder:", error);
      throw error;
    }
  }

  async ensureFolderPermission(folderId) {
    try {
      await this.drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: "reader",
          type: "user",
          emailAddress: process.env.EMAIL_USER,
        },
      });
      console.log(`Set public permission for folder: ${folderId}`);
    } catch (error) {
      console.error(`Error setting folder permission: ${error.message}`);
    }
  }

  async uploadToGoogleDrive(
    file,
    category = "others",
    itemCategory = "others"
  ) {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error("Google Drive not initialized properly");
      }

      // Pilih folder yang tepat berdasarkan kategori
      let targetFolderId = this.folderId; // default: root folder

      if (category === "lost_items" || category === "found_items") {
        // Cari folder kategori item jika tersedia
        const folderKey = `${category}_${itemCategory}`;
        if (this.folderIds[folderKey]) {
          targetFolderId = this.folderIds[folderKey];
        }
        // Fallback ke folder utama kategori jika subfolder tidak ada
        else if (this.folderIds[category]) {
          targetFolderId = this.folderIds[category];
        }
      }
      // Gunakan folder kategori jika tersedia
      else if (this.folderIds[category]) {
        targetFolderId = this.folderIds[category];
      }

      // Buat nama file yang unik dengan timestamp dan uuid
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${timestamp}-${uuidv4()}${path.extname(
        file.originalname || ".jpg"
      )}`;

      const fileMetadata = {
        name: fileName,
        parents: [targetFolderId],
        description: `UNYLost ${category} - ${new Date().toISOString()}`,
      };

      // Siapkan media dengan stream yang benar
      let stream;

      if (file.buffer) {
        console.log(`Creating stream from buffer for file: ${fileName}`);
        stream = bufferToStream(file.buffer);
      } else if (file.path) {
        console.log(`Creating stream from file path: ${file.path}`);
        stream = fs.createReadStream(file.path);
      } else {
        throw new Error("No file buffer or path provided");
      }

      // Upload file ke Google Drive
      console.log(`Starting upload to Google Drive: ${fileName}`);
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: file.mimetype || "image/jpeg",
          body: stream,
        },
        fields: "id,webViewLink,webContentLink",
      });

      console.log(`File uploaded successfully. ID: ${response.data.id}`);

      // Set permission agar dapat diakses publik
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Gunakan direct link yang bisa diakses oleh AI layer
      const fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      console.log(`File public URL: ${fileUrl}`);

      // Tambahkan metadata kategori ke file
      await this.drive.files.update({
        fileId: response.data.id,
        requestBody: {
          appProperties: {
            category: category,
            itemCategory: itemCategory || "others",
            uploadedBy: "UNYLost App",
          },
        },
      });

      return fileUrl;
    } catch (error) {
      console.error("Error uploading to Google Drive:", error);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files,
    category = "others",
    itemCategory = "others"
  ) {
    try {
      const fileUrls = [];

      for (const file of files) {
        let fileUrl;

        // Coba upload ke Google Drive terlebih dahulu
        if (this.drive && this.folderId) {
          try {
            fileUrl = await this.uploadToGoogleDrive(
              file,
              category,
              itemCategory
            );
          } catch (driveError) {
            console.error("Error uploading to Google Drive:", driveError);
            console.log("Falling back to local storage");
            fileUrl = await this.uploadFile(file);
          }
        } else {
          // Jika Google Drive tidak tersedia, gunakan penyimpanan lokal
          fileUrl = await this.uploadFile(file);
        }

        fileUrls.push(fileUrl);
      }

      return fileUrls;
    } catch (error) {
      console.error("Error uploading multiple files:", error);
      throw error;
    }
  }

  // Metode upload lokal (sebagai fallback)
  async uploadFile(file) {
    try {
      const extension = path.extname(file.originalname || ".jpg");
      const fileName = `${uuidv4()}${extension}`;
      const filePath = path.join(this.uploadDir, fileName);

      console.log(`Uploading file locally: ${fileName}`);

      // Buat writable stream
      const writeStream = fs.createWriteStream(filePath);

      // Tulis buffer file ke stream
      writeStream.write(file.buffer);
      writeStream.end();

      // Return URL lengkap
      const fullUrl = `http://localhost:5000/uploads/${fileName}`;
      console.log(`File uploaded locally: ${fullUrl}`);
      return fullUrl;
    } catch (error) {
      console.error("Error uploading file locally:", error);
      throw error;
    }
  }
  async uploadFile(file) {
    try {
      const extension = path.extname(file.originalname || ".jpg");
      const fileName = `${uuidv4()}${extension}`;
      const filePath = path.join(this.uploadDir, fileName);

      console.log(`Uploading file locally: ${fileName}`);

      // Buat writable stream
      const writeStream = fs.createWriteStream(filePath);

      // Tulis buffer file ke stream
      writeStream.write(file.buffer);
      writeStream.end();

      // Return URL lengkap
      const fullUrl = `http://localhost:5000/uploads/${fileName}`;
      console.log(`File uploaded locally: ${fullUrl}`);
      return fullUrl;
    } catch (error) {
      console.error("Error uploading file locally:", error);
      throw error;
    }
  }

  async deleteFile(fileUrl) {
    try {
      // Untuk file Google Drive
      if (fileUrl && fileUrl.includes("drive.google.com")) {
        // Ekstrak ID file dari URL
        const match = fileUrl.match(/id=([^&]+)/);
        if (match && match[1] && this.drive) {
          const fileId = match[1];
          await this.drive.files.delete({ fileId });
          console.log(`Deleted file from Google Drive: ${fileId}`);
          return true;
        }
      }
      // Untuk file lokal
      else if (fileUrl && fileUrl.includes("/uploads/")) {
        // Ekstrak nama file dari URL
        const fileName = path.basename(fileUrl);
        const filePath = path.join(this.uploadDir, fileName);

        // Periksa apakah file ada
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file locally: ${filePath}`);
          return true;
        }
      }

      console.warn(`File not found or cannot be deleted: ${fileUrl}`);
      return false;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  validateFile(file) {
    // Periksa ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: "File size exceeds the limit (5MB)" };
    }

    // Periksa tipe file (hanya gambar)
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: "Invalid file type. Only images are allowed",
      };
    }

    return { valid: true };
  }
}

module.exports = new FileService();
