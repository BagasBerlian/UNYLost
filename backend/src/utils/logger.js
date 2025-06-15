const winston = require("winston");
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "uny-lost-backend",
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],

  exitOnError: false,
});

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: "debug",
    })
  );
}

// Create helper methods for structured logging
const createLoggerMethods = (baseLogger) => {
  return {
    // Basic logging methods
    error: (message, meta = {}) => baseLogger.error(message, meta),
    warn: (message, meta = {}) => baseLogger.warn(message, meta),
    info: (message, meta = {}) => baseLogger.info(message, meta),
    debug: (message, meta = {}) => baseLogger.debug(message, meta),

    // Structured logging methods
    apiRequest: (req, meta = {}) => {
      baseLogger.info("API Request", {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        userId: req.userId,
        ...meta,
      });
    },

    apiResponse: (req, res, responseTime, meta = {}) => {
      baseLogger.info("API Response", {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.userId,
        ...meta,
      });
    },

    apiError: (req, error, meta = {}) => {
      baseLogger.error("API Error", {
        method: req.method,
        url: req.originalUrl,
        error: error.message,
        stack: error.stack,
        userId: req.userId,
        ...meta,
      });
    },

    databaseQuery: (query, duration, meta = {}) => {
      baseLogger.debug("Database Query", {
        query: query.substring(0, 200) + (query.length > 200 ? "..." : ""),
        duration: `${duration}ms`,
        ...meta,
      });
    },

    authEvent: (event, userId, meta = {}) => {
      baseLogger.info("Auth Event", {
        event,
        userId,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },

    systemEvent: (event, meta = {}) => {
      baseLogger.info("System Event", {
        event,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },

    securityEvent: (event, details, meta = {}) => {
      baseLogger.warn("Security Event", {
        event,
        details,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },

    performanceMetric: (metric, value, unit = "ms", meta = {}) => {
      baseLogger.info("Performance Metric", {
        metric,
        value,
        unit,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },

    aiEvent: (event, itemId, result, meta = {}) => {
      baseLogger.info("AI Event", {
        event,
        itemId,
        result,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },

    whatsappEvent: (event, phoneNumber, success, meta = {}) => {
      baseLogger.info("WhatsApp Event", {
        event,
        phoneNumber: phoneNumber ? phoneNumber.replace(/\d{4}$/, "****") : null, // Mask last 4 digits
        success,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    },
  };
};

// Export enhanced logger
module.exports = createLoggerMethods(logger);
