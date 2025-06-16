// File: backend/src/app.js - COMPLETE FIXED VERSION WITH ALL ENDPOINTS
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - ALLOW ALL IPs FOR DEVELOPMENT
app.use(cors({
  origin: '*', // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Support legacy browsers
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database connection
let db;

async function setupDatabase() {
  try {
    // Create database if not exists
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'uny_lost_db'}\``);
    await connection.end();

    // Connect to the database
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'uny_lost_db'
    });

    // Create users table - SESUAI SEQUENCE DIAGRAM
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        firstName VARCHAR(50) NOT NULL,
        lastName VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        whatsappNumber VARCHAR(20) UNIQUE NOT NULL,
        isWhatsappVerified BOOLEAN DEFAULT FALSE,
        agreeNotification BOOLEAN DEFAULT FALSE,
        verificationCode VARCHAR(10),
        verified BOOLEAN DEFAULT FALSE,
        verifiedAt DATETIME NULL,
        profilePicture TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        lastLogin DATETIME,
        lastLogout DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create verification codes table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        type ENUM('email', 'whatsapp', 'password_reset') NOT NULL,
        expiresAt DATETIME NOT NULL,
        attempts INT DEFAULT 0,
        isUsed BOOLEAN DEFAULT FALSE,
        userId VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database connected and tables created');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

// Utility functions
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      verified: user.verified
    },
    process.env.JWT_SECRET || 'uny-lost-secret-key-2024',
    { expiresIn: '7d' }
  );
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhoneNumber(phone) {
  // Normalize Indonesian phone numbers
  let normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.startsWith('0')) {
    normalized = '+62' + normalized.substring(1);
  } else if (normalized.startsWith('62')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+62')) {
    normalized = '+62' + normalized;
  }
  return normalized;
}

async function storeVerificationCode(identifier, code, type, expireMinutes = 10) {
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
  
  // Delete existing codes for this identifier
  await db.execute(
    'DELETE FROM verification_codes WHERE identifier = ? AND type = ?',
    [identifier, type]
  );
  
  // Insert new code
  await db.execute(
    'INSERT INTO verification_codes (identifier, code, type, expiresAt) VALUES (?, ?, ?, ?)',
    [identifier, code, type, expiresAt]
  );
  
  console.log(`📧 ${type} verification code for ${identifier}: ${code} (expires: ${expiresAt})`);
}

// Middleware for authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'uny-lost-secret-key-2024', (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'UNY Lost Backend is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to UNY Lost API',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check request body
app.post('/api/debug/verify-whatsapp', (req, res) => {
  console.log('🔍 DEBUG: Headers received:', req.headers);
  console.log('🔍 DEBUG: Body received:', req.body);
  console.log('🔍 DEBUG: Body type:', typeof req.body);
  console.log('🔍 DEBUG: Phone value:', req.body.phone);
  console.log('🔍 DEBUG: Phone type:', typeof req.body.phone);
  
  res.json({
    success: true,
    debug: {
      headers: req.headers,
      body: req.body,
      phoneValue: req.body.phone,
      phoneType: typeof req.body.phone
    }
  });
});

// WHATSAPP VERIFICATION ENDPOINT - SESUAI SEQUENCE DIAGRAM
app.post('/api/auth/verify-whatsapp', [
  body('phone').notEmpty().withMessage('Phone number required')
], async (req, res) => {
  try {
    // Debug logging
    console.log('📱 WhatsApp verification request received');
    console.log('📱 Request body:', req.body);
    console.log('📱 Request headers:', req.headers);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { phone } = req.body;
    const normalized = normalizePhoneNumber(phone);

    console.log(`📱 WhatsApp verification: ${phone} -> ${normalized}`);

    // Simulate WhatsApp verification (in production, integrate with real WhatsApp API)
    // For now, we'll just validate the phone format
    if (!/^\+62\d{9,13}$/.test(normalized)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indonesian phone number format'
      });
    }

    const result = {
      success: true,
      verified: true,
      message: 'WhatsApp number verified successfully'
    };

    console.log(`✅ WhatsApp verified: ${normalized}`);
    res.json(result);
    
  } catch (error) {
    console.error('WhatsApp verification error:', error);
    res.status(500).json({
      success: false,
      message: 'WhatsApp verification failed'
    });
  }
});

// REGISTRATION ENDPOINT - SESUAI SEQUENCE DIAGRAM
app.post('/api/auth/register', [
  body('firstName').notEmpty().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').notEmpty().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('whatsappNumber').notEmpty().withMessage('WhatsApp number required'),
  body('agreeNotification').isBoolean().withMessage('Notification agreement required')
], async (req, res) => {
  try {
    // Debug logging
    console.log('📝 Registration request received');
    console.log('📝 Request headers:', req.headers);
    console.log('📝 Request body:', req.body);
    console.log('📝 Body keys:', Object.keys(req.body));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Registration validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, whatsappNumber, agreeNotification } = req.body;
    const normalizedWhatsApp = normalizePhoneNumber(whatsappNumber);

    console.log(`📝 Registration attempt: ${firstName} ${lastName} (${email})`);

    // Check for existing user
    const [existingUsers] = await db.execute(
      'SELECT email, whatsappNumber FROM users WHERE email = ? OR whatsappNumber = ?',
      [email, normalizedWhatsApp]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or WhatsApp number'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (firstName, lastName, email, passwordHash, whatsappNumber, agreeNotification, verificationCode, verified) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)',
      [firstName, lastName, email, hashedPassword, normalizedWhatsApp, agreeNotification, verificationCode]
    );

    // Store verification code
    await storeVerificationCode(email, verificationCode, 'email', 10);

    // Get created user
    const [users] = await db.execute(
      'SELECT id, firstName, lastName, email, whatsappNumber, isWhatsappVerified, verified FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = users[0];

    console.log(`✅ User registered: ${email} (ID: ${user.id})`);
    console.log(`📧 Email verification code: ${verificationCode}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Verification code sent to email.',
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isWhatsappVerified: user.isWhatsappVerified,
          verified: user.verified
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// EMAIL VERIFICATION ENDPOINT - SESUAI SEQUENCE DIAGRAM
app.post('/api/auth/verify-email', [
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, code } = req.body;

    console.log(`📧 Email verification attempt: ${email} with code: ${code}`);

    // Get user and verification code
    const [users] = await db.execute(
      'SELECT id, firstName, lastName, email, verificationCode, verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Check verification code from verification_codes table
    const [codes] = await db.execute(
      'SELECT code, expiresAt, attempts FROM verification_codes WHERE identifier = ? AND type = "email" AND isUsed = FALSE ORDER BY createdAt DESC LIMIT 1',
      [email]
    );

    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.'
      });
    }

    const codeData = codes[0];

    // Check if code expired
    if (new Date() > new Date(codeData.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new one.'
      });
    }

    // Check if code matches
    if (codeData.code !== code) {
      // Increment attempts
      await db.execute(
        'UPDATE verification_codes SET attempts = attempts + 1 WHERE identifier = ? AND type = "email"',
        [email]
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Verify user
    await db.execute(
      'UPDATE users SET verified = TRUE, verifiedAt = NOW(), verificationCode = NULL WHERE email = ?',
      [email]
    );

    // Mark code as used
    await db.execute(
      'UPDATE verification_codes SET isUsed = TRUE WHERE identifier = ? AND type = "email"',
      [email]
    );

    console.log(`✅ Email verified: ${email}`);

    res.json({
      success: true,
      message: 'Email verified successfully!'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
});

// LOGIN ENDPOINT - SESUAI SEQUENCE DIAGRAM
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    console.log(`🔐 Login attempt: ${email}`);

    // Find user
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user is verified
    if (!user.verified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await db.execute(
      'UPDATE users SET lastLogin = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate token
    const token = generateToken(user);

    console.log(`✅ Login successful: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isWhatsappVerified: user.isWhatsappVerified,
          verified: user.verified,
          profilePicture: user.profilePicture,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// DASHBOARD ENDPOINT - SESUAI SEQUENCE DIAGRAM
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log(`📊 Dashboard request from user: ${req.userId}`);

    // Get user profile
    const [users] = await db.execute(
      'SELECT id, firstName, lastName, email, whatsappNumber, isWhatsappVerified, verified, profilePicture, lastLogin, createdAt FROM users WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get basic statistics (placeholder for future items functionality)
    const stats = {
      lostItems: {
        total: 0,
        active: 0,
        resolved: 0
      },
      foundItems: {
        total: 0,
        available: 0,
        claimed: 0
      },
      matches: {
        total: 0,
        new: 0,
        contacted: 0
      },
      claims: {
        total: 0,
        pending: 0,
        approved: 0
      }
    };

    console.log(`✅ Dashboard data sent for user: ${user.email}`);

    res.json({
      success: true,
      data: {
        user,
        stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data'
    });
  }
});

// Get profile endpoint
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, firstName, lastName, email, whatsappNumber, isWhatsappVerified, verified, profilePicture, lastLogin, createdAt FROM users WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: users[0]
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
async function startServer() {
  try {
    console.log('🔄 Starting UNY Lost Backend...');
    
    // Setup database
    await setupDatabase();
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 UNY Lost Backend running!');
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
      console.log(`🗄️ Database: Connected`);
      console.log('✅ Ready for authentication!');
      console.log('\n📋 Available endpoints:');
      console.log('   GET  /api/health');
      console.log('   POST /api/auth/verify-whatsapp');
      console.log('   POST /api/auth/register');
      console.log('   POST /api/auth/verify-email');
      console.log('   POST /api/auth/login');
      console.log('   GET  /api/dashboard');
      console.log('   GET  /api/auth/me');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down server...');
  if (db) {
    await db.end();
  }
  process.exit(0);
});

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;