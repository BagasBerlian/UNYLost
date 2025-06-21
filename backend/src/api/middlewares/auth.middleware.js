const jwt = require("jsonwebtoken");
const config = require("../../config/app");
const User = require("../../models/user.model");

exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized access" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(403)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

exports.requireVerification = async (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      error: "Email verification required",
      message: "Please verify your email before proceeding",
    });
  }
  next();
};

exports.requireWhatsAppVerification = async (req, res, next) => {
  if (!req.user.isWhatsappVerified) {
    return res.status(403).json({
      success: false,
      error: "WhatsApp verification required",
      message: "Please verify your WhatsApp number before proceeding",
    });
  }
  next();
};
