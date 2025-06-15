// File: backend/src/services/verificationService.js
const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const logger = require("../utils/logger");
const emailService = require("./emailService");
const whatsappService = require("./whatsappService");

// In-memory storage for verification codes (production should use Redis)
const verificationCodes = new Map();

class VerificationService {
  /**
   * Generate verification code
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  }

  /**
   * Generate verification token
   */
  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Store verification code
   */
  storeCode(identifier, code, type = "email", expiresIn = 10) {
    const expiresAt = Date.now() + expiresIn * 60 * 1000; // minutes to milliseconds

    verificationCodes.set(identifier, {
      code,
      type,
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
    });

    logger.info(`Verification code stored for ${identifier} (${type})`);
  }

  /**
   * Verify code
   */
  verifyCode(identifier, inputCode) {
    const stored = verificationCodes.get(identifier);

    if (!stored) {
      return { success: false, message: "No verification code found" };
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(identifier);
      return { success: false, message: "Verification code expired" };
    }

    stored.attempts++;

    if (stored.attempts > stored.maxAttempts) {
      verificationCodes.delete(identifier);
      return { success: false, message: "Too many attempts" };
    }

    if (stored.code !== inputCode) {
      return { success: false, message: "Invalid verification code" };
    }

    // Success - remove code
    verificationCodes.delete(identifier);
    return { success: true, message: "Verification successful" };
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email, userName) {
    try {
      const code = this.generateCode();
      this.storeCode(email, code, "email", 10); // 10 minutes

      const subject = "UNY Lost - Verifikasi Email";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verifikasi Email UNY Lost</h2>
          <p>Halo ${userName},</p>
          <p>Kode verifikasi Anda adalah:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2196F3; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>Kode ini berlaku selama 10 menit.</p>
          <p>Jika Anda tidak meminta verifikasi ini, abaikan email ini.</p>
          <p>Tim UNY Lost</p>
        </div>
      `;

      const result = await emailService.sendEmail(email, subject, html);

      if (result.success) {
        logger.info(`Email verification sent to ${email}`);
        return { success: true, message: "Verification email sent" };
      } else {
        return { success: false, message: "Failed to send email" };
      }
    } catch (error) {
      logger.error("Send email verification error:", error);
      return { success: false, message: "Verification service error" };
    }
  }

  /**
   * Send WhatsApp verification
   */
  async sendWhatsAppVerification(whatsappNumber, userName) {
    try {
      const code = this.generateCode();
      this.storeCode(whatsappNumber, code, "whatsapp", 5); // 5 minutes

      const message = `
🔐 *UNY Lost - Verifikasi WhatsApp*

Halo ${userName},

Kode verifikasi Anda: *${code}*

Kode berlaku 5 menit.
Jangan bagikan kode ini kepada siapapun.

Tim UNY Lost - Universitas Negeri Yogyakarta
      `.trim();

      const result = await whatsappService.sendMessage(whatsappNumber, message);

      if (result) {
        logger.info(`WhatsApp verification sent to ${whatsappNumber}`);
        return { success: true, message: "Verification WhatsApp sent" };
      } else {
        return { success: false, message: "Failed to send WhatsApp" };
      }
    } catch (error) {
      logger.error("Send WhatsApp verification error:", error);
      return { success: false, message: "WhatsApp service error" };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, userName) {
    try {
      const token = this.generateToken();
      this.storeCode(email, token, "password_reset", 60); // 60 minutes

      const resetUrl = `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/reset-password?token=${token}`;

      const subject = "UNY Lost - Reset Password";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Password UNY Lost</h2>
          <p>Halo ${userName},</p>
          <p>Anda telah meminta reset password untuk akun UNY Lost Anda.</p>
          <p>Klik tombol di bawah untuk reset password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>Atau copy link berikut ke browser:</p>
          <p style="background: #f5f5f5; padding: 10px; word-break: break-all;">${resetUrl}</p>
          <p>Link ini berlaku selama 1 jam.</p>
          <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
          <p>Tim UNY Lost</p>
        </div>
      `;

      const result = await emailService.sendEmail(email, subject, html);

      if (result.success) {
        logger.info(`Password reset email sent to ${email}`);
        return { success: true, message: "Password reset email sent", token };
      } else {
        return { success: false, message: "Failed to send reset email" };
      }
    } catch (error) {
      logger.error("Send password reset error:", error);
      return { success: false, message: "Password reset service error" };
    }
  }

  /**
   * Check WhatsApp number validity (basic check)
   */
  async validateWhatsAppNumber(number) {
    try {
      // Normalize number
      let normalized = number.replace(/\s|-|\(|\)/g, "");
      if (normalized.startsWith("0")) {
        normalized = "+62" + normalized.substring(1);
      } else if (normalized.startsWith("62")) {
        normalized = "+" + normalized;
      } else if (!normalized.startsWith("+62")) {
        normalized = "+62" + normalized;
      }

      // Basic format validation
      const isValid = /^\+628[1-9][0-9]{6,11}$/.test(normalized);

      if (!isValid) {
        return {
          success: false,
          message: "Invalid WhatsApp number format",
          normalized,
        };
      }

      // TODO: Integrate dengan WhatsApp Business API untuk cek nomor aktif
      // For now, just return success if format is valid

      return {
        success: true,
        message: "WhatsApp number format valid",
        normalized,
      };
    } catch (error) {
      logger.error("WhatsApp validation error:", error);
      return {
        success: false,
        message: "WhatsApp validation service error",
      };
    }
  }

  /**
   * Cleanup expired codes (should be called periodically)
   */
  cleanupExpiredCodes() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of verificationCodes.entries()) {
      if (now > value.expiresAt) {
        verificationCodes.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired verification codes`);
    }
  }

  /**
   * Get verification stats (for monitoring)
   */
  getStats() {
    return {
      totalCodes: verificationCodes.size,
      codesByType: {
        email: Array.from(verificationCodes.values()).filter(
          (v) => v.type === "email"
        ).length,
        whatsapp: Array.from(verificationCodes.values()).filter(
          (v) => v.type === "whatsapp"
        ).length,
        password_reset: Array.from(verificationCodes.values()).filter(
          (v) => v.type === "password_reset"
        ).length,
      },
    };
  }
}

// Start cleanup job (every 5 minutes)
const verificationService = new VerificationService();
setInterval(() => {
  verificationService.cleanupExpiredCodes();
}, 5 * 60 * 1000);

module.exports = verificationService;
