const { Sequelize } = require("sequelize");

exports.handleErrors = (err, req, res, next) => {
  console.error(err.stack);

  // Sequelize validation error
  if (err instanceof Sequelize.ValidationError) {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: err.errors.map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Database error
  if (err instanceof Sequelize.DatabaseError) {
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "A database error occurred",
    });
  }

  // JWT error
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: "Authentication Error",
      message: "Invalid token",
    });
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: "Server Error",
    message: err.message || "An unexpected error occurred",
  });
};
