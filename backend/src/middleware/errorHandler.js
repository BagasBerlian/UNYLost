const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.apiError(req, err, {
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(e => e.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 409 };
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Foreign key constraint error';
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Rate limiting errors
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = {
    success: false,
    message,
    ...(isDevelopment && { 
      stack: err.stack,
      error: err 
    })
  };

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  
  logger.warn('Route Not Found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message,
    code: 'ROUTE_NOT_FOUND'
  });
};

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle specific error types
 */
const handleSpecificErrors = {
  // Database connection errors
  handleDBConnectionError: (err, req, res, next) => {
    if (err.code === 'ECONNREFUSED' && err.syscall === 'connect') {
      logger.error('Database connection refused', { error: err.message });
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable',
        code: 'DB_CONNECTION_ERROR'
      });
    }
    next(err);
  },

  // AI service errors
  handleAIServiceError: (err, req, res, next) => {
    if (err.code === 'AI_SERVICE_UNAVAILABLE') {
      logger.warn('AI service unavailable', { error: err.message });
      return res.status(503).json({
        success: false,
        message: 'AI matching service temporarily unavailable',
        code: 'AI_SERVICE_ERROR'
      });
    }
    next(err);
  },

  // File service errors
  handleFileServiceError: (err, req, res, next) => {
    if (err.code === 'FILE_UPLOAD_ERROR') {
      logger.error('File upload error', { error: err.message });
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        code: 'FILE_UPLOAD_ERROR'
      });
    }
    next(err);
  },

  // WhatsApp service errors
  handleWhatsAppError: (err, req, res, next) => {
    if (err.code === 'WHATSAPP_SEND_ERROR') {
      logger.warn('WhatsApp send error', { error: err.message });
      // Don't fail the main operation, just log the error
      return res.status(200).json({
        success: true,
        message: 'Operation completed, but notification delivery may be delayed',
        warning: 'WhatsApp notification failed'
      });
    }
    next(err);
  }
};

/**
 * Request timeout handler
 */
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      const err = new AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
      next(err);
    });
    next();
  };
};

/**
 * Security error handler
 */
const securityErrorHandler = (err, req, res, next) => {
  // Log security-related errors
  const securityErrors = [
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'UNAUTHORIZED_ACCESS',
    'FORBIDDEN_ACTION',
    'RATE_LIMIT_EXCEEDED'
  ];

  if (securityErrors.includes(err.code)) {
    logger.securityEvent('Security Error', {
      error: err.message,
      code: err.code,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId,
      url: req.originalUrl
    });
  }

  next(err);
};

/**
 * Development error handler with more details
 */
const developmentErrorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Development Error Details:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('Request:', {
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.userId
    });
  }
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  handleSpecificErrors,
  timeoutHandler,
  securityErrorHandler,
  developmentErrorHandler
};