#!/usr/bin/env node
/**
 * Debug Google Drive Access
 * Jalankan: node debug-gdrive.js
 */

require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");

async function debugGoogleDrive() {
  console.log("🔍 Debugging Google Drive Access...\n");

  try {
    const keyPath =
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      "./config/serviceAccountKey.json";
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log(`📁 Key Path: ${keyPath}`);
    console.log(`📂 Folder ID: ${folderId}\n`);

    // 1. Check if service account file exists
    if (!fs.existsSync(keyPath)) {
      console.log("❌ Service account key file not found!");
      return;
    }

    // 2. Read and display service account info
    const keyData = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    console.log("📧 Service Account Email:", keyData.client_email);
    console.log("🆔 Project ID:", keyData.project_id);
    console.log(
      "🔑 Private Key ID:",
      keyData.private_key_id.substring(0, 10) + "...\n"
    );

    // 3. Initialize Google Drive
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 4. Test general Drive access
    console.log("🔍 Testing general Drive API access...");
    const filesResponse = await drive.files.list({ pageSize: 3 });
    console.log("✅ Drive API working!");
    console.log(
      `📊 Found ${filesResponse.data.files.length} files in your Drive\n`
    );

    // 5. Try to get folder by ID with detailed error
    console.log(`🎯 Testing access to specific folder: ${folderId}`);
    try {
      const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: "id,name,owners,permissions,parents,mimeType,createdTime",
      });

      console.log("✅ Folder access successful!");
      console.log("📂 Folder Details:");
      console.log(`   Name: ${folderResponse.data.name}`);
      console.log(`   ID: ${folderResponse.data.id}`);
      console.log(`   Type: ${folderResponse.data.mimeType}`);
      console.log(`   Created: ${folderResponse.data.createdTime}\n`);

      // Try to list permissions
      try {
        const permissions = await drive.permissions.list({
          fileId: folderId,
          fields: "permissions(id,type,role,emailAddress)",
        });

        console.log("👥 Folder Permissions:");
        permissions.data.permissions.forEach((perm) => {
          console.log(
            `   ${perm.type}: ${perm.emailAddress || perm.id} (${perm.role})`
          );
        });
      } catch (permError) {
        console.log("⚠️  Could not list permissions (normal for some folders)");
      }
    } catch (folderError) {
      console.log("❌ Folder access failed!");
      console.log("📋 Error details:", folderError.message);
      console.log("🔧 Error code:", folderError.code);

      console.log("\n🛠️  Troubleshooting steps:");

      if (folderError.code === 404) {
        console.log("1. ❌ Folder not found - possible causes:");
        console.log("   • Wrong folder ID");
        console.log("   • Folder was deleted");
        console.log("   • Service account has no access");

        console.log("\n🔧 Try these solutions:");
        console.log("1. Create a NEW folder in Google Drive");
        console.log("2. Share it with your service account email:");
        console.log(`   ${keyData.client_email}`);
        console.log('3. Set permission to "Editor"');
        console.log("4. Copy the NEW folder ID from URL");
        console.log("5. Update GOOGLE_DRIVE_FOLDER_ID in .env");
      } else if (folderError.code === 403) {
        console.log("1. ❌ Permission denied:");
        console.log("   • Service account needs access");
        console.log("   • Share folder with service account email");
      } else {
        console.log("1. ❌ Unexpected error:");
        console.log("   • Check internet connection");
        console.log("   • Verify service account key is valid");
      }

      // Try to create a test folder as workaround
      console.log("\n🧪 Trying to create a test folder...");
      try {
        const testFolder = await drive.files.create({
          resource: {
            name: "UNY Lost Test Folder",
            mimeType: "application/vnd.google-apps.folder",
          },
        });

        console.log("✅ Test folder created successfully!");
        console.log(`📂 New folder ID: ${testFolder.data.id}`);
        console.log(
          `🔗 URL: https://drive.google.com/drive/folders/${testFolder.data.id}`
        );
        console.log("\n💡 You can use this folder ID in your .env file:");
        console.log(`GOOGLE_DRIVE_FOLDER_ID=${testFolder.data.id}`);
      } catch (createError) {
        console.log("❌ Could not create test folder:", createError.message);
      }
    }

    // 6. Test file upload to the folder (if accessible)
    console.log("\n📤 Testing file upload...");
    try {
      // Create a simple test file
      const testContent = "UNY Lost Test File - " + new Date().toISOString();

      const uploadResponse = await drive.files.create({
        resource: {
          name: "uny-lost-test.txt",
          parents: [folderId],
        },
        media: {
          mimeType: "text/plain",
          body: testContent,
        },
      });

      console.log("✅ File upload test successful!");
      console.log(`📄 Test file ID: ${uploadResponse.data.id}`);

      // Clean up test file
      await drive.files.delete({ fileId: uploadResponse.data.id });
      console.log("🗑️  Test file cleaned up");
    } catch (uploadError) {
      console.log("❌ File upload test failed:", uploadError.message);
    }
  } catch (error) {
    console.log("❌ Google Drive debug failed:", error.message);
    console.log("\n🔧 General troubleshooting:");
    console.log(
      "1. Check if Google Drive API is enabled in Google Cloud Console"
    );
    console.log("2. Verify service account key is valid and not expired");
    console.log("3. Check internet connection");
  }
}

debugGoogleDrive().catch(console.error);
