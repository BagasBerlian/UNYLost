#!/usr/bin/env node
/**
 * Fixed Test Setup Script untuk UNY Lost Backend
 * Jalankan: node test-setup.js
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const axios = require("axios");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const fs = require("fs");

console.log("🧪 Testing UNY Lost Backend Setup...\n");

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

const success = (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`);
const error = (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`);
const warning = (msg) =>
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
const info = (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);

// Test functions
async function testEnvironmentVariables() {
  console.log("\n1. 🔧 Testing Environment Variables...");

  const required = [
    "DB_HOST",
    "DB_NAME",
    "DB_USERNAME",
    "JWT_SECRET",
    "FONNTE_API_TOKEN",
    "GOOGLE_DRIVE_FOLDER_ID",
    "SENDGRID_API_KEY",
  ];

  let allPresent = true;

  required.forEach((key) => {
    if (process.env[key]) {
      success(`${key}: Set`);
    } else {
      error(`${key}: Missing`);
      allPresent = false;
    }
  });

  return allPresent;
}

async function testDatabaseConnection() {
  console.log("\n2. 🗄️ Testing MySQL Database Connection...");

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "uny_lost_db",
    });

    await connection.execute("SELECT 1 as test");
    await connection.end();

    success("MySQL database connection successful");
    return true;
  } catch (err) {
    error(`Database connection failed: ${err.message}`);
    warning("Make sure MySQL is running in Laragon and database exists");
    return false;
  }
}

async function testGoogleDriveAccess() {
  console.log("\n3. 📂 Testing Google Drive Access...");

  try {
    const keyPath =
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      "./config/serviceAccountKey.json";

    if (!fs.existsSync(keyPath)) {
      error(`Service account key not found: ${keyPath}`);
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    // Test list files
    const response = await drive.files.list({ pageSize: 1 });

    success("Google Drive API access successful");

    // Test folder access
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId) {
      try {
        await drive.files.get({ fileId: folderId });
        success("Google Drive folder access successful");
        return true;
      } catch (folderErr) {
        error(`Folder access failed: ${folderErr.message}`);
        warning("Check if folder ID is correct and service account has access");
        info("📋 To fix Google Drive folder access:");
        info("1. Copy the correct folder ID from Google Drive URL");
        info("2. Share the folder with your service account email");
        info("3. Make sure service account has Editor permission");
        return false;
      }
    }

    return true;
  } catch (err) {
    error(`Google Drive test failed: ${err.message}`);
    return false;
  }
}

async function testSendGridEmail() {
  console.log("\n4. 📧 Testing SendGrid Email...");

  try {
    // Fix: Use correct nodemailer syntax
    const transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });

    await transporter.verify();
    success("SendGrid SMTP connection successful");

    // Optional: Send test email
    const sendTest = process.argv.includes("--send-email");
    if (sendTest) {
      const testEmail = process.argv[process.argv.indexOf("--send-email") + 1];
      if (testEmail && testEmail.includes("@")) {
        info("Sending test email...");
        await transporter.sendMail({
          from: '"UNY Lost Test" <noreply@test.com>',
          to: testEmail,
          subject: "UNY Lost - Email Test",
          text: "This is a test email from UNY Lost backend setup verification.",
          html: "<h2>🧪 SendGrid Test</h2><p>This email confirms SendGrid is working!</p>",
        });
        success(`Test email sent to ${testEmail}`);
      }
    } else {
      info(
        "To test email sending, run: node test-setup.js --send-email your@email.com"
      );
    }

    return true;
  } catch (err) {
    error(`SendGrid test failed: ${err.message}`);
    warning("Check if API key is correct and has send permissions");
    info("📋 To fix SendGrid:");
    info("1. Login to SendGrid dashboard");
    info("2. Go to Settings > Sender Authentication");
    info("3. Verify a sender email address");
    info("4. Check API key has Mail Send permission");
    return false;
  }
}

async function testFonnte() {
  console.log("\n5. 📱 Testing Fonnte WhatsApp API...");

  try {
    const response = await axios.post(
      "https://api.fonnte.com/send",
      {
        target: "6281234567890", // Test number
        message: "Test connection - ignore this message",
        countryCode: "62",
      },
      {
        headers: {
          Authorization: process.env.FONNTE_API_TOKEN,
          "Content-Type": "application/json",
        },
        timeout: 10000,
        validateStatus: () => true, // Accept all status codes
      }
    );

    if (response.data && response.data.status !== undefined) {
      success("Fonnte API connection successful");
      info(`Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      warning("Fonnte API responded but format unexpected");
      return false;
    }
  } catch (err) {
    error(`Fonnte test failed: ${err.message}`);
    warning("Check if API token is correct");
    return false;
  }
}

async function testAILayerConnection() {
  console.log("\n6. 🤖 Testing AI Layer Connection...");

  try {
    const aiUrl = process.env.AI_LAYER_URL || "http://localhost:8000";

    // Try multiple endpoints to find working one
    const endpoints = [
      "/", // Root endpoint
      "/health/status", // Health endpoint
      "/docs", // FastAPI docs
    ];

    let connected = false;
    let workingEndpoint = null;

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${aiUrl}${endpoint}`, {
          timeout: 5000,
          validateStatus: (status) => status < 500, // Accept 4xx as valid connection
        });

        if (response.status < 500) {
          connected = true;
          workingEndpoint = endpoint;
          break;
        }
      } catch (err) {
        // Continue to next endpoint
        continue;
      }
    }

    if (connected) {
      success(`AI Layer connection successful (${workingEndpoint})`);
      info(`AI Layer is running on ${aiUrl}`);
      return true;
    } else {
      error("AI Layer connection failed on all endpoints");
      warning("Make sure AI Layer is running on http://localhost:8000");
      info("📋 To start AI Layer:");
      info("1. Open terminal in ai-layer directory");
      info("2. Run: python run.py");
      info("3. Check if it starts on port 8000");
      return false;
    }
  } catch (err) {
    error(`AI Layer test failed: ${err.message}`);
    return false;
  }
}

async function testDirectoryStructure() {
  console.log("\n7. 📁 Testing Directory Structure...");

  const dirs = ["config", "logs", "uploads", "temp_images"];
  let allExist = true;

  dirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      success(`Directory exists: ${dir}/`);
    } else {
      error(`Directory missing: ${dir}/`);
      allExist = false;
    }
  });

  return allExist;
}

async function generateSummaryReport(results) {
  console.log("\n📊 SETUP SUMMARY REPORT");
  console.log("========================");

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter((r) => r).length;
  const failed = total - passed;

  console.log(`Total Tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);

  if (failed === 0) {
    success("🎉 All tests passed! Your setup is ready for development.");
    info("You can now run: npm run dev");
  } else if (failed <= 2) {
    warning(`${failed} test(s) failed, but you can still start development.`);
    info("You can run: npm run dev (some features may not work)");

    if (!results.googleDrive) {
      warning("🔧 Google Drive: Fix folder ID and permissions when ready");
    }
    if (!results.sendgrid) {
      warning("🔧 SendGrid: Fix email configuration when ready");
    }
    if (!results.aiLayer) {
      warning("🔧 AI Layer: Start the AI service for matching features");
    }
  } else {
    error("Too many critical failures. Please fix issues before continuing.");
  }

  console.log("\n🚀 Quick Start Commands:");
  console.log("  npm run dev          # Start backend server");
  console.log("  npm test            # Run tests");
  console.log("  node test-email.js  # Test email service");
}

// Main test runner
async function runTests() {
  const results = {};

  try {
    results.environment = await testEnvironmentVariables();
    results.database = await testDatabaseConnection();
    results.googleDrive = await testGoogleDriveAccess();
    results.sendgrid = await testSendGridEmail();
    results.fonnte = await testFonnte();
    results.aiLayer = await testAILayerConnection();
    results.directories = await testDirectoryStructure();

    await generateSummaryReport(results);
  } catch (err) {
    error(`Test runner failed: ${err.message}`);
  }
}

// Run the tests
runTests().catch(console.error);
