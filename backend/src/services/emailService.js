const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@unylost.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'UNY Lost System';
    
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   * Support multiple free email providers
   */
  async initializeTransporter() {
    try {
      const provider = process.env.EMAIL_PROVIDER || 'gmail'; // gmail, outlook, mailgun
      
      let transportConfig;
      
      switch (provider) {
        case 'gmail':
          transportConfig = {
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER, // your.email@gmail.com
              pass: process.env.GMAIL_APP_PASSWORD // App password, bukan password biasa
            }
          };
          break;
          
        case 'outlook':
          transportConfig = {
            service: 'hotmail',
            auth: {
              user: process.env.OUTLOOK_USER, // your.email@outlook.com
              pass: process.env.OUTLOOK_PASSWORD
            }
          };
          break;
          
        case 'mailgun':
          transportConfig = {
            host: 'smtp.mailgun.org',
            port: 587,
            secure: false,
            auth: {
              user: process.env.MAILGUN_SMTP_USERNAME,
              pass: process.env.MAILGUN_SMTP_PASSWORD
            }
          };
          break;
          
        case 'sendgrid':
          transportConfig = {
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY
            }
          };
          break;
          
        default:
          // Custom SMTP
          transportConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          };
      }
      
      this.transporter = nodemailer.createTransporter(transportConfig);
      
      // Test connection
      await this.transporter.verify();
      logger.info(`✅ Email service initialized with ${provider}`);
      
    } catch (error) {
      logger.error('❌ Email service initialization failed:', error);
      this.transporter = null;
    }
  }

  /**
   * Send email
   */
  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent || this.htmlToText(htmlContent)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error) {
      logger.error('Send email error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(userEmail, userName) {
    const subject = 'Selamat Datang di UNY Lost!';
    const html = this.templates.welcome(userName);
    
    return await this.sendEmail(userEmail, subject, html);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail, userName, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Reset Password - UNY Lost';
    const html = this.templates.passwordReset(userName, resetUrl);
    
    return await this.sendEmail(userEmail, subject, html);
  }

  /**
   * Send match found email
   */
  async sendMatchFoundEmail(userEmail, userName, itemName, similarity, location) {
    const subject = `Match Ditemukan untuk ${itemName}!`;
    const html = this.templates.matchFound(userName, itemName, similarity, location);
    
    return await this.sendEmail(userEmail, subject, html);
  }

  /**
   * Send claim notification email
   */
  async sendClaimNotificationEmail(userEmail, userName, itemName, claimerName, isApproved) {
    const status = isApproved ? 'Disetujui' : 'Diterima';
    const subject = `Klaim ${status} - ${itemName}`;
    const html = isApproved 
      ? this.templates.claimApproved(userName, itemName, claimerName)
      : this.templates.claimReceived(userName, itemName, claimerName);
    
    return await this.sendEmail(userEmail, subject, html);
  }

  /**
   * Convert HTML to plain text
   */
  htmlToText(html) {
    return html
      .replace(/<style[^>]*>.*<\/style>/gi, '')
      .replace(/<script[^>]*>.*<\/script>/gi, '')
      .replace(/<[^>]+>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Email templates
   */
  get templates() {
    return {
      welcome: (userName) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to UNY Lost</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c5aa0; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #2c5aa0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Selamat Datang di UNY Lost!</h1>
            </div>
            <div class="content">
              <h2>Halo ${userName}!</h2>
              <p>Selamat datang di sistem Lost & Found Universitas Negeri Yogyakarta. Akun Anda telah berhasil terdaftar.</p>
              
              <h3>Fitur Utama:</h3>
              <ul>
                <li>📱 Laporkan barang hilang atau temuan</li>
                <li>🎯 Matching otomatis dengan teknologi AI</li>
                <li>🔔 Notifikasi real-time via WhatsApp dan email</li>
                <li>📊 Dashboard untuk monitoring status barang</li>
              </ul>
              
              <p>Mulai gunakan aplikasi sekarang dan temukan barang hilang Anda!</p>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}" class="button">Buka Aplikasi</a>
              </p>
            </div>
            <div class="footer">
              <p>Tim UNY Lost - Universitas Negeri Yogyakarta</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      passwordReset: (userName, resetUrl) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Password - UNY Lost</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Reset Password</h1>
            </div>
            <div class="content">
              <h2>Halo ${userName},</h2>
              <p>Anda telah meminta untuk mereset password akun UNY Lost Anda.</p>
              
              <p>Klik tombol di bawah untuk membuat password baru:</p>
              
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              
              <div class="warning">
                <strong>⚠️ Penting:</strong>
                <ul>
                  <li>Link reset akan kedaluwarsa dalam <strong>1 jam</strong></li>
                  <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
                  <li>Jangan bagikan link ini kepada orang lain</li>
                </ul>
              </div>
              
              <p>Jika tombol tidak berfungsi, copy dan paste URL berikut ke browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 3px;">
                ${resetUrl}
              </p>
            </div>
            <div class="footer">
              <p>Tim UNY Lost - Universitas Negeri Yogyakarta</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      matchFound: (userName, itemName, similarity, location) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Match Ditemukan! - UNY Lost</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
            .match-info { background: white; border: 2px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .similarity { font-size: 24px; font-weight: bold; color: #28a745; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Match Ditemukan!</h1>
            </div>
            <div class="content">
              <h2>Halo ${userName},</h2>
              <p>Kabar baik! Sistem AI kami menemukan barang yang sangat mirip dengan yang Anda hilangkan.</p>
              
              <div class="match-info">
                <h3>📱 Detail Match:</h3>
                <ul>
                  <li><strong>Barang:</strong> ${itemName}</li>
                  <li><strong>Lokasi Ditemukan:</strong> ${location}</li>
                  <li><strong>Tingkat Kemiripan:</strong> 
                    <span class="similarity">${Math.round(similarity * 100)}%</span>
                  </li>
                </ul>
              </div>
              
              <p>Untuk melihat detail lengkap dan mengajukan klaim, silakan buka aplikasi UNY Lost.</p>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/matches" class="button">Lihat Detail Match</a>
              </p>
              
              <p><em>Semakin tinggi persentase kemiripan, semakin besar kemungkinan ini adalah barang Anda.</em></p>
            </div>
            <div class="footer">
              <p>Tim UNY Lost - Universitas Negeri Yogyakarta</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      claimReceived: (userName, itemName, claimerName) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Klaim Baru Diterima - UNY Lost</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #17a2b8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
            .claim-info { background: white; border: 2px solid #17a2b8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👥 Klaim Baru Diterima!</h1>
            </div>
            <div class="content">
              <h2>Halo ${userName},</h2>
              <p>Ada seseorang yang mengklaim barang temuan Anda. Silakan review klaim tersebut.</p>
              
              <div class="claim-info">
                <h3>📋 Detail Klaim:</h3>
                <ul>
                  <li><strong>Barang:</strong> ${itemName}</li>
                  <li><strong>Pengklaim:</strong> ${claimerName}</li>
                  <li><strong>Status:</strong> Menunggu Review</li>
                </ul>
              </div>
              
              <p>Sebagai penemu barang, Anda perlu mereview klaim ini dan memutuskan apakah akan menyetujui atau menolaknya berdasarkan bukti kepemilikan yang diberikan.</p>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/claims/received" class="button">Review Klaim</a>
              </p>
              
              <p><strong>Tips Review Klaim:</strong></p>
              <ul>
                <li>Periksa detail yang diberikan pengklaim</li>
                <li>Bandingkan dengan kondisi barang yang Anda temukan</li>
                <li>Jika ragu, Anda bisa menghubungi pengklaim untuk konfirmasi lebih lanjut</li>
              </ul>
            </div>
            <div class="footer">
              <p>Tim UNY Lost - Universitas Negeri Yogyakarta</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      claimApproved: (userName, itemName, finderName) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Klaim Disetujui! - UNY Lost</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; }
            .success-info { background: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Klaim Disetujui!</h1>
            </div>
            <div class="content">
              <h2>Selamat ${userName}!</h2>
              <p>Klaim Anda telah disetujui oleh penemu barang. Anda dapat segera mengambil barang Anda.</p>
              
              <div class="success-info">
                <h3>🎉 Detail Persetujuan:</h3>
                <ul>
                  <li><strong>Barang:</strong> ${itemName}</li>
                  <li><strong>Penemu:</strong> ${finderName}</li>
                  <li><strong>Status:</strong> Siap untuk diambil</li>
                </ul>
              </div>
              
              <p>Langkah selanjutnya:</p>
              <ol>
                <li>Buka aplikasi UNY Lost untuk melihat kontak penemu</li>
                <li>Hubungi penemu untuk mengatur waktu dan tempat pengambilan</li>
                <li>Bawa identitas diri saat mengambil barang</li>
                <li>Jangan lupa ucapkan terima kasih kepada penemu! 😊</li>
              </ol>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/claims/my" class="button">Lihat Detail Kontak</a>
              </p>
            </div>
            <div class="footer">
              <p>Tim UNY Lost - Universitas Negeri Yogyakarta</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isConnected: !!this.transporter,
      provider: process.env.EMAIL_PROVIDER || 'gmail',
      fromEmail: this.fromEmail,
      fromName: this.fromName
    };
  }

  /**
   * Test email connection
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      
      await this.transporter.verify();
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = { EmailService: new EmailService() };