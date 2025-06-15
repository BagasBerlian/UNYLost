#!/usr/bin/env node
/**
 * Fixed Gmail Test
 * Jalankan: node test-gmail-fixed.js
 */

require("dotenv").config();
const nodemailer = require("nodemailer");

async function testGmailSetup() {
  console.log("📧 Testing Gmail Configuration for UNY Lost...\n");

  try {
    // Check environment variables
    console.log("🔧 Checking Gmail configuration...");

    const requiredVars = ["GMAIL_USER", "GMAIL_APP_PASSWORD"];
    let configOk = true;

    requiredVars.forEach((varName) => {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: Set`);
      } else {
        console.log(`❌ ${varName}: Missing`);
        configOk = false;
      }
    });

    if (!configOk) {
      console.log("\n❌ Gmail configuration incomplete!");
      return;
    }

    console.log(`📨 From Email: ${process.env.GMAIL_USER}`);
    console.log(
      `🏷️  From Name: ${process.env.SMTP_FROM_NAME || "UNY Lost System"}\n`
    );

    // Create Gmail transporter (FIXED: createTransport not createTransporter)
    console.log("🔗 Creating Gmail connection...");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Test connection
    console.log("🧪 Testing Gmail connection...");
    await transporter.verify();
    console.log("✅ Gmail connection successful!\n");

    // Send test email
    console.log("📤 Sending test email...");
    const testEmail = process.argv[2] || process.env.GMAIL_USER;

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "UNY Lost System"}" <${
        process.env.GMAIL_USER
      }>`,
      to: testEmail,
      subject: "🎉 UNY Lost - Gmail Setup Berhasil!",
      html: `
        <h2>🎉 Gmail Setup Berhasil!</h2>
        <p>Gmail integration UNY Lost backend sudah berfungsi dengan sempurna!</p>
        
        <h3>📋 Detail Konfigurasi:</h3>
        <ul>
          <li><strong>Provider:</strong> Gmail</li>
          <li><strong>From Email:</strong> ${process.env.GMAIL_USER}</li>
          <li><strong>From Name:</strong> ${
            process.env.SMTP_FROM_NAME || "UNY Lost System"
          }</li>
          <li><strong>Test Time:</strong> ${new Date().toLocaleString(
            "id-ID"
          )}</li>
        </ul>
        
        <h3>🚀 Siap untuk Development!</h3>
        <p>Backend UNY Lost siap mengirim:</p>
        <ul>
          <li>📧 Welcome emails</li>
          <li>🔐 Password reset emails</li>
          <li>🎯 Match found notifications</li>
          <li>✅ Claim status updates</li>
        </ul>
        
        <p><strong>Start development dengan:</strong> <code>npm run dev</code></p>
        
        <hr>
        <p><em>Tim UNY Lost - Universitas Negeri Yogyakarta</em></p>
      `,
      text: `
UNY Lost - Gmail Setup Berhasil!

Gmail integration sudah berfungsi dengan sempurna!

Detail Konfigurasi:
- Provider: Gmail
- From Email: ${process.env.GMAIL_USER}
- From Name: ${process.env.SMTP_FROM_NAME || "UNY Lost System"}
- Test Time: ${new Date().toLocaleString("id-ID")}

Siap untuk Development!
Backend UNY Lost siap mengirim welcome emails, password reset, match notifications, dan claim updates.

Start development dengan: npm run dev

Tim UNY Lost - Universitas Negeri Yogyakarta
      `,
    });

    console.log("✅ Test email sent successfully!");
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📬 Sent to: ${testEmail}`);

    console.log("\n🎉 Gmail setup completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. ✅ Check your email inbox");
    console.log(
      "2. 🧪 Run full test: node test-setup-final.js --send-email lian4dev@gmail.com"
    );
    console.log("3. 🚀 Start development: npm run dev");
  } catch (error) {
    console.log("❌ Gmail test failed:", error.message);

    console.log("\n🔧 Troubleshooting:");

    if (
      error.message.includes("Invalid login") ||
      error.message.includes("Username and Password not accepted")
    ) {
      console.log("❌ Authentication failed:");
      console.log("   • Wrong email or app password");
      console.log("   • Make sure 2FA is enabled on your Google account");
      console.log("   • Generate new App Password (not regular password)");
      console.log("   • App Password format: xxxx xxxx xxxx xxxx (16 digits)");
    } else if (error.message.includes("Less secure app")) {
      console.log("❌ Security settings:");
      console.log("   • Must use App Password, not regular password");
      console.log("   • Enable 2FA first, then generate App Password");
    } else if (error.message.includes("EAUTH")) {
      console.log("❌ Authentication error:");
      console.log(
        "   • Double-check GMAIL_USER and GMAIL_APP_PASSWORD in .env"
      );
      console.log("   • Regenerate App Password if needed");
    } else if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("timeout")
    ) {
      console.log("❌ Network error:");
      console.log("   • Check internet connection");
      console.log("   • Try again in a few minutes");
    } else {
      console.log("❌ Other error:");
      console.log("   • Verify Gmail account is active and accessible");
      console.log("   • Check if account has 2FA enabled");
    }

    console.log("\n📋 Required .env setup:");
    console.log("EMAIL_PROVIDER=gmail");
    console.log("GMAIL_USER=lian4dev@gmail.com");
    console.log("GMAIL_APP_PASSWORD=your_16_digit_app_password");
    console.log("SMTP_FROM_EMAIL=lian4dev@gmail.com");
    console.log("SMTP_FROM_NAME=UNY Lost System");

    console.log("\n🔗 Helpful links:");
    console.log("• Google 2FA: https://myaccount.google.com/security");
    console.log("• App Passwords: https://myaccount.google.com/apppasswords");
  }
}

testGmailSetup().catch(console.error);
