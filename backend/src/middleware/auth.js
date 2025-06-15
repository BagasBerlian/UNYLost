const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key');
    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user exists and is active
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'isActive']
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Add user info to request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.user = user;

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without authentication
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key');
      
      const user = await User.findByPk(decoded.userId, {
        attributes: ['id', 'email', 'isActive']
      });

      if (user && user.isActive) {
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.user = user;
      }
    } catch (tokenError) {
      // Invalid token, but continue without auth
      logger.warn('Invalid token in optional auth:', tokenError.message);
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

module.exports = authenticateToken;
module.exports.optionalAuth = optionalAuth;