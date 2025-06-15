const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { User } = require('../models');
const logger = require('../utils/logger');
const { WhatsAppService } = require('../services/whatsappService');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT'
  }
});

// Input validation rules
const registerValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('whatsappNumber')
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/)
    .withMessage('Valid Indonesian WhatsApp number is required')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Helper function to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      email: user.email 
    },
    process.env.JWT_SECRET || 'uny_lost_secret_key',
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
    }
  );
}

// Helper function to normalize WhatsApp number
function normalizeWhatsAppNumber(number) {
  // Remove spaces and special characters
  let normalized = number.replace(/\s|-|\(|\)/g, '');
  
  // Convert to international format
  if (normalized.startsWith('0')) {
    normalized = '+62' + normalized.substring(1);
  } else if (normalized.startsWith('62')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+62')) {
    normalized = '+62' + normalized;
  }
  
  return normalized;
}

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { fullName, email, password, whatsappNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        $or: [
          { email: email.toLowerCase() },
          { whatsappNumber: normalizeWhatsAppNumber(whatsappNumber) }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or WhatsApp number',
        code: 'USER_EXISTS'
      });
    }

    // Normalize WhatsApp number
    const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);

    // Verify WhatsApp number
    const whatsappVerification = await WhatsAppService.verifyNumber(normalizedWhatsApp);
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      whatsappNumber: normalizedWhatsApp,
      isWhatsappVerified: whatsappVerification.isValid && whatsappVerification.isRegistered
    });

    // Generate token
    const token = generateToken(newUser);

    // Log registration
    logger.info(`New user registered: ${email} (${newUser.id})`);

    // Send welcome message via WhatsApp
    if (newUser.isWhatsappVerified) {
      try {
        await WhatsAppService.sendWelcomeMessage(normalizedWhatsApp, fullName);
      } catch (whatsappError) {
        logger.warn('Failed to send welcome WhatsApp message:', whatsappError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          whatsappNumber: newUser.whatsappNumber,
          isWhatsappVerified: newUser.isWhatsappVerified,
          notificationSettings: newUser.notificationSettings,
          createdAt: newUser.createdAt
        },
        token
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Check validation errors
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
    const user = await User.findOne({
      where: { 
        email: email.toLowerCase(),
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate token
    const token = generateToken(user);

    // Log login
    logger.info(`User logged in: ${email} (${user.id})`);

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
          profilePicture: user.profilePicture,
          notificationSettings: user.notificationSettings,
          lastLogin: user.lastLogin
        },
        token
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * @route   POST /api/auth/verify-whatsapp
 * @desc    Verify WhatsApp number
 * @access  Public
 */
router.post('/verify-whatsapp', [
  body('phone')
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/)
    .withMessage('Valid Indonesian WhatsApp number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
        errors: errors.array()
      });
    }

    const { phone } = req.body;
    const normalizedPhone = normalizeWhatsAppNumber(phone);

    // Verify with WhatsApp service
    const verification = await WhatsAppService.verifyNumber(normalizedPhone);

    res.json({
      success: true,
      data: {
        phone: normalizedPhone,
        isValid: verification.isValid,
        isRegistered: verification.isRegistered,
        message: verification.message
      }
    });

  } catch (error) {
    logger.error('WhatsApp verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify WhatsApp number',
      code: 'WHATSAPP_VERIFY_ERROR'
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({
      where: { 
        email: email.toLowerCase(),
        isActive: true
      }
    });

    // Always return success for security (don't reveal if email exists)
    if (user && user.isWhatsappVerified) {
      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        process.env.JWT_SECRET || 'uny_lost_secret_key',
        { expiresIn: '1h' }
      );

      // Send reset link via WhatsApp
      try {
        await WhatsAppService.sendPasswordResetMessage(
          user.whatsappNumber, 
          user.fullName, 
          resetToken
        );
      } catch (whatsappError) {
        logger.warn('Failed to send password reset WhatsApp:', whatsappError.message);
      }
    }

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent to your WhatsApp'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'FORGOT_PASSWORD_ERROR'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
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

    const { token, newPassword } = req.body;

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key');
    } catch (tokenError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await user.update({ password: hashedPassword });

    logger.info(`Password reset successful for user: ${user.email} (${user.id})`);

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'RESET_PASSWORD_ERROR'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isWhatsappVerified: user.isWhatsappVerified,
          profilePicture: user.profilePicture,
          notificationSettings: user.notificationSettings,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'GET_PROFILE_ERROR'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', require('../middleware/auth'), async (req, res) => {
  try {
    logger.info(`User logged out: ${req.userId}`);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'LOGOUT_ERROR'
    });
  }
});

module.exports = router;