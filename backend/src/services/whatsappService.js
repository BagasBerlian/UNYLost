const axios = require("axios");
const logger = require("../utils/logger");

class WhatsAppService {
  constructor() {
    // Fonnte API Configuration
    this.apiUrl = "https://api.fonnte.com/send";
    this.apiToken = process.env.FONNTE_API_TOKEN; // Get from fonnte.com
    this.timeout = 10000; // 10 seconds
    this.maxRetries = 3;

    // Rate limiting
    this.lastSent = new Map(); // phone -> timestamp
    this.minInterval = 60000; // 1 minute between messages to same number
    this.dailyLimit = 3; // Max 3 messages per user per day
    this.dailyCount = new Map(); // phone -> { date, count }
  }

  /**
   * Verify WhatsApp number (basic validation for Fonnte)
   */
  async verifyNumber(phoneNumber) {
    try {
      // For Fonnte, we'll do basic validation
      // Fonnte doesn't have dedicated number verification endpoint
      const isValid = this.validatePhoneNumber(phoneNumber);

      return {
        isValid,
        isRegistered: isValid, // Assume valid numbers are registered
        message: isValid
          ? "Nomor valid untuk WhatsApp"
          : "Format nomor tidak valid",
      };
    } catch (error) {
      logger.error("WhatsApp verify number error:", error);
      return {
        isValid: false,
        isRegistered: false,
        message: "Gagal memverifikasi nomor",
      };
    }
  }

  /**
   * Send welcome message to new user
   */
  async sendWelcomeMessage(phoneNumber, userName) {
    try {
      const message = this.templates.welcome(userName);
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send welcome message error:", error);
      throw error;
    }
  }

  /**
   * Send match found notification
   */
  async sendMatchFoundNotification(
    phoneNumber,
    itemName,
    similarity,
    location
  ) {
    try {
      if (!this.canSendMessage(phoneNumber)) {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        return false;
      }

      const message = this.templates.matchFound(itemName, similarity, location);
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send match found notification error:", error);
      throw error;
    }
  }

  /**
   * Send claim received notification
   */
  async sendClaimReceivedNotification(phoneNumber, itemName, claimerName) {
    try {
      if (!this.canSendMessage(phoneNumber)) {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        return false;
      }

      const message = this.templates.claimReceived(itemName, claimerName);
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send claim received notification error:", error);
      throw error;
    }
  }

  /**
   * Send claim approved notification
   */
  async sendClaimApprovedNotification(
    phoneNumber,
    itemName,
    finderName,
    finderPhone
  ) {
    try {
      if (!this.canSendMessage(phoneNumber)) {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        return false;
      }

      const message = this.templates.claimApproved(
        itemName,
        finderName,
        finderPhone
      );
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send claim approved notification error:", error);
      throw error;
    }
  }

  /**
   * Send claim rejected notification
   */
  async sendClaimRejectedNotification(phoneNumber, itemName, reason) {
    try {
      if (!this.canSendMessage(phoneNumber)) {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        return false;
      }

      const message = this.templates.claimRejected(itemName, reason);
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send claim rejected notification error:", error);
      throw error;
    }
  }

  /**
   * Send password reset message
   */
  async sendPasswordResetMessage(phoneNumber, userName, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const message = this.templates.passwordReset(userName, resetUrl);
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error("Send password reset message error:", error);
      throw error;
    }
  }

  /**
   * Core method to send WhatsApp message via Fonnte
   */
  async sendMessage(phoneNumber, message, retryCount = 0) {
    try {
      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number format");
      }

      // Check if API token is configured
      if (!this.apiToken) {
        // For development/testing, log the message instead of sending
        logger.info(`[Fonnte WhatsApp] To: ${phoneNumber}`);
        logger.info(`[Fonnte WhatsApp] Content: ${message}`);
        this.updateRateLimit(phoneNumber);
        return true;
      }

      // Send via Fonnte API
      const response = await this.sendViaFonnte(phoneNumber, message);

      if (response.success) {
        this.updateRateLimit(phoneNumber);
        logger.info(`WhatsApp message sent via Fonnte to ${phoneNumber}`);
        return true;
      } else {
        throw new Error(response.reason || "Failed to send WhatsApp message");
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn(
          `Fonnte send failed, retrying... (${retryCount + 1}/${
            this.maxRetries
          })`
        );
        await this.sleep(1000 * (retryCount + 1));
        return this.sendMessage(phoneNumber, message, retryCount + 1);
      }

      logger.error("Fonnte send message error:", error);
      return false;
    }
  }

  /**
   * Send message via Fonnte API
   */
  async sendViaFonnte(phoneNumber, message) {
    try {
      // Fonnte API format
      const payload = {
        target: phoneNumber,
        message: message,
        countryCode: "62", // Indonesia country code
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          Authorization: this.apiToken,
          "Content-Type": "application/json",
        },
        timeout: this.timeout,
      });

      // Fonnte response format
      if (response.data && response.data.status) {
        return {
          success: true,
          messageId: response.data.id,
          detail: response.data.detail,
        };
      } else {
        return {
          success: false,
          reason: response.data.reason || "Unknown error",
        };
      }
    } catch (error) {
      return {
        success: false,
        reason: error.response?.data?.reason || error.message,
      };
    }
  }

  /**
   * Validate Indonesian phone number format
   */
  validatePhoneNumber(phoneNumber) {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, "");

    // Check Indonesian mobile patterns
    // 08xxxxxxxxx or 628xxxxxxxxx or +628xxxxxxxxx
    const patterns = [
      /^08[1-9][0-9]{6,11}$/, // 08xxxxxxxxx
      /^628[1-9][0-9]{6,11}$/, // 628xxxxxxxxx
      /^\+628[1-9][0-9]{6,11}$/, // +628xxxxxxxxx
    ];

    return (
      patterns.some((pattern) => pattern.test(phoneNumber)) ||
      /^8[1-9][0-9]{6,11}$/.test(cleaned)
    ); // Just 8xxxxxxxxx
  }

  /**
   * Check if we can send message (rate limiting)
   */
  canSendMessage(phoneNumber) {
    const now = Date.now();
    const today = new Date().toDateString();

    // Check minimum interval
    const lastSent = this.lastSent.get(phoneNumber);
    if (lastSent && now - lastSent < this.minInterval) {
      return false;
    }

    // Check daily limit
    const dailyData = this.dailyCount.get(phoneNumber);
    if (
      dailyData &&
      dailyData.date === today &&
      dailyData.count >= this.dailyLimit
    ) {
      return false;
    }

    return true;
  }

  /**
   * Update rate limiting counters
   */
  updateRateLimit(phoneNumber) {
    const now = Date.now();
    const today = new Date().toDateString();

    // Update last sent time
    this.lastSent.set(phoneNumber, now);

    // Update daily count
    const dailyData = this.dailyCount.get(phoneNumber);
    if (dailyData && dailyData.date === today) {
      dailyData.count++;
    } else {
      this.dailyCount.set(phoneNumber, { date: today, count: 1 });
    }

    // Cleanup old entries (keep only today's data)
    for (const [phone, data] of this.dailyCount.entries()) {
      if (data.date !== today) {
        this.dailyCount.delete(phone);
      }
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Message templates
   */
  get templates() {
    return {
      welcome: (userName) =>
        `
🎉 *Selamat datang di UNY Lost!*

Halo ${userName}! Akun Anda telah berhasil terdaftar.

UNY Lost membantu Anda menemukan barang hilang dengan teknologi AI yang canggih.

Fitur utama:
📱 Laporkan barang hilang/temuan
🎯 Matching otomatis dengan AI
🔔 Notifikasi real-time

Mulai gunakan aplikasi sekarang!

_Tim UNY Lost_
      `.trim(),

      matchFound: (itemName, similarity, location) =>
        `
🎉 *UNY Lost - Match Ditemukan!*

Sistem menemukan barang yang *${Math.round(
          similarity * 100
        )}%* mirip dengan yang Anda hilangkan:

📱 *Barang:* ${itemName}
📍 *Lokasi:* ${location}
🎯 *Kemiripan:* ${Math.round(similarity * 100)}%

Buka aplikasi UNY Lost untuk melihat detail dan mengajukan klaim.

_Pesan otomatis dari sistem_
      `.trim(),

      claimReceived: (itemName, claimerName) =>
        `
👥 *UNY Lost - Klaim Baru!*

Seseorang mengklaim barang temuan Anda:

📱 *Barang:* ${itemName}
👤 *Pengklaim:* ${claimerName}

Silakan buka aplikasi untuk review klaim dan bukti kepemilikan.

_Pesan otomatis dari sistem_
      `.trim(),

      claimApproved: (itemName, finderName, finderPhone) =>
        `
✅ *UNY Lost - Klaim Diterima!*

Klaim Anda untuk *${itemName}* telah disetujui!

👤 *Kontak Pelapor:*
Nama: ${finderName}
WA: ${finderPhone}

Silakan koordinasi untuk pengambilan barang.

_Pesan otomatis dari sistem_
      `.trim(),

      claimRejected: (itemName, reason) =>
        `
❌ *UNY Lost - Klaim Ditolak*

Maaf, klaim Anda untuk *${itemName}* ditolak.

${reason ? `Alasan: ${reason}` : "Bukti kepemilikan tidak sesuai"}

Anda masih bisa mengajukan klaim untuk barang lain yang mirip.

_Pesan otomatis dari sistem_
      `.trim(),

      passwordReset: (userName, resetUrl) =>
        `
🔐 *UNY Lost - Reset Password*

Halo ${userName},

Anda meminta reset password. Klik link berikut untuk membuat password baru:

${resetUrl}

Link ini akan kedaluwarsa dalam 1 jam.

Jika Anda tidak meminta reset password, abaikan pesan ini.

_Tim UNY Lost_
      `.trim(),
    };
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      rateLimit: {
        activeNumbers: this.lastSent.size,
        dailyCounters: this.dailyCount.size,
        minInterval: this.minInterval,
        dailyLimit: this.dailyLimit,
      },
      config: {
        apiUrl: this.apiUrl,
        hasApiToken: !!this.apiToken,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
        provider: "Fonnte",
      },
    };
  }
}

// Export singleton instance
module.exports = { WhatsAppService: new WhatsAppService() };
