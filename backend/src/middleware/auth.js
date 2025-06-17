// File: backend/src/middleware/auth.js
// Enhanced Auth Middleware untuk extract user email dari JWT token

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Enhanced Auth Middleware
 * Verifies JWT token and extracts complete user information including email
 */
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key_2024');
    
    // Find user dan attach ke req.user
    const [userRows] = await db.execute(
      'SELECT id, firstName, lastName, email, whatsappNumber FROM users WHERE id = ? AND isActive = 1',
      [decoded.userId]
    );

    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = userRows[0]; // Attach user data termasuk email
    next();

  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Optional Auth Middleware
 * Extracts user info if token is provided, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user info
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      req.user = null;
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key_2024');

    // Find user in database
    const user = await User.findOne({
      where: { 
        id: decoded.userId,
        isActive: true 
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'whatsappNumber', 'isWhatsappVerified', 'verified']
    });

    if (user && user.verified) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        whatsappNumber: user.whatsappNumber,
        isWhatsappVerified: user.isWhatsappVerified,
        verified: user.verified
      };
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    // If token verification fails, continue without user info
    logger.warn(`Optional auth failed: ${error.message}`);
    req.user = null;
    next();
  }
};

/**
 * Admin Auth Middleware
 * Requires admin role (if implemented)
 */
const adminAuth = async (req, res, next) => {
  try {
    // First run normal auth
    await new Promise((resolve, reject) => {
      auth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check if user has admin role (implement based on your user model)
    // For now, checking if user email contains 'admin' or specific admin emails
    const adminEmails = [
      'admin@uny.ac.id',
      'lost.found.admin@uny.ac.id'
    ];

    const isAdmin = adminEmails.includes(req.user.email) || 
                   req.user.email.includes('admin@uny.ac.id');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();

  } catch (error) {
    logger.error(`Admin authentication error: ${error.message}`);
    res.status(401).json({
      success: false,
      message: 'Admin authentication failed'
    });
  }
};

/**
 * Rate limiting middleware for authenticated users
 */
const authRateLimit = (req, res, next) => {
  // Implement rate limiting based on user ID
  // This is a placeholder - implement with Redis or memory store
  
  if (req.user) {
    // Log user activity for rate limiting
    logger.info(`API call from user: ${req.user.email} to ${req.method} ${req.path}`);
  }
  
  next();
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  authRateLimit
};