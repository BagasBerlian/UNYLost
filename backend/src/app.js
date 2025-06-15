// File: backend/src/app.js - FIXED REAL VERSION
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

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        fullName VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        whatsappNumber VARCHAR(20) NOT NULL,
        isWhatsappVerified BOOLEAN DEFAULT FALSE,
        isEmailVerified BOOLEAN DEFAULT FALSE,
        profilePicture TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        lastLogin DATETIME,
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
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_expires (expiresAt)
      )
    `);

    console.log('✅ Database connected and tables created');
    return db;
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

// Helper functions
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      email: user.email 
    },
    process.env.JWT_SECRET || 'uny_lost_secret_key',
    { expiresIn: '7d' }
  );
}

function normalizeWhatsAppNumber(number) {
  let normalized = number.replace(/\s|-|\(|\)/g, '');
  if (normalized.startsWith('0')) {
    normalized = '+62' + normalized.substring(1);
  } else if (normalized.startsWith('62')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+62')) {
    normalized = '+62' + normalized;
  }
  return normalized;
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeVerificationCode(identifier, code, type, expiresInMinutes = 10) {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  // Delete old codes for this identifier
  await db.execute(
    'DELETE FROM verification_codes WHERE identifier = ? AND type = ?',
    [identifier, type]
  );
  
  // Insert new code
  await db.execute(
    'INSERT INTO verification_codes (identifier, code, type, expiresAt) VALUES (?, ?, ?, ?)',
    [identifier, code, type, expiresAt]
  );
  
  console.log(`Verification code stored for ${identifier} (${type}): ${code}`);
}

async function verifyCode(identifier, inputCode, type) {
  const [rows] = await db.execute(
    'SELECT * FROM verification_codes WHERE identifier = ? AND type = ? AND isUsed = FALSE ORDER BY createdAt DESC LIMIT 1',
    [identifier, type]
  );
  
  if (rows.length === 0) {
    return { success: false, message: 'No verification code found' };
  }
  
  const stored = rows[0];
  
  if (new Date() > new Date(stored.expiresAt)) {
    await db.execute('DELETE FROM verification_codes WHERE id = ?', [stored.id]);
    return { success: false, message: 'Verification code expired' };
  }
  
  // Increment attempts
  await db.execute(
    'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?',
    [stored.id]
  );
  
  if (stored.attempts >= 3) {
    await db.execute('DELETE FROM verification_codes WHERE id = ?', [stored.id]);
    return { success: false, message: 'Too many attempts' };
  }
  
  if (stored.code !== inputCode) {
    return { success: false, message: 'Invalid verification code' };
  }
  
  // Mark as used
  await db.execute(
    'UPDATE verification_codes SET isUsed = TRUE WHERE id = ?',
    [stored.id]
  );
  
  return { success: true, message: 'Verification successful' };
}

// Middleware for authentication
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key');
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    app: 'UNY Lost Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: 'connected',
    endpoints: {
      auth: '/api/auth',
      health: '/api/health'
    }
  });
});

// Health endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await db.execute('SELECT 1');
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Register endpoint
app.post('/api/auth/register', [
  body('fullName').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('whatsappNumber').matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/)
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

    const { fullName, email, password, whatsappNumber } = req.body;
    const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);

    // Check if user exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR whatsappNumber = ?',
      [email, normalizedWhatsApp]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (fullName, email, password, whatsappNumber) VALUES (?, ?, ?, ?)',
      [fullName, email, hashedPassword, normalizedWhatsApp]
    );

    // Get created user
    const [users] = await db.execute(
      'SELECT id, fullName, email, whatsappNumber, isWhatsappVerified, isEmailVerified FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = users[0];

    // Generate verification codes
    const emailCode = generateVerificationCode();
    const whatsappCode = generateVerificationCode();
    
    await storeVerificationCode(email, emailCode, 'email', 10);
    await storeVerificationCode(normalizedWhatsApp, whatsappCode, 'whatsapp', 5);

    // Generate token
    const token = generateToken(user);

    console.log(`✅ User registered: ${email}`);
    console.log(`📧 Email verification code: ${emailCode}`);
    console.log(`📱 WhatsApp verification code: ${whatsappCode}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isWhatsappVerified: false,
          isEmailVerified: false
        },
        token,
        verificationCodes: {
          email: emailCode, // In production, don't return codes
          whatsapp: whatsappCode
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login endpoint
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

    // Find user
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND isActive = TRUE',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.execute(
      'UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate token
    const token = generateToken(user);

    console.log(`✅ User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isWhatsappVerified: user.isWhatsappVerified,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin
        },
        token
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

// Verify email endpoint
app.post('/api/auth/verify-email', [
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const result = await verifyCode(email, code, 'email');
    
    if (result.success) {
      // Mark email as verified
      await db.execute(
        'UPDATE users SET isEmailVerified = TRUE WHERE email = ?',
        [email]
      );
      
      console.log(`✅ Email verified: ${email}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// Verify WhatsApp endpoint
app.post('/api/auth/verify-whatsapp', [
  body('whatsappNumber').notEmpty(),
  body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const { whatsappNumber, code } = req.body;
    const normalized = normalizeWhatsAppNumber(whatsappNumber);
    
    const result = await verifyCode(normalized, code, 'whatsapp');
    
    if (result.success) {
      // Mark WhatsApp as verified
      await db.execute(
        'UPDATE users SET isWhatsappVerified = TRUE WHERE whatsappNumber = ?',
        [normalized]
      );
      
      console.log(`✅ WhatsApp verified: ${normalized}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('WhatsApp verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// Get profile endpoint
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, fullName, email, whatsappNumber, isWhatsappVerified, isEmailVerified, profilePicture, lastLogin, createdAt FROM users WHERE id = ?',
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
    app.listen(PORT, () => {
      console.log('🚀 UNY Lost Backend running!');
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🗄️ Database: Connected`);
      console.log('✅ Ready for real authentication!');
      console.log('\n📋 Available endpoints:');
      console.log('   POST /api/auth/register');
      console.log('   POST /api/auth/login');
      console.log('   POST /api/auth/verify-email');
      console.log('   POST /api/auth/verify-whatsapp');
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