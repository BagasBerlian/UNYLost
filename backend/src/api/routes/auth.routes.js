const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/auth.controller");
const AuthMiddleware = require("../middlewares/auth.middleware");

// Public routes
router.post("/register", AuthController.register);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-verification", AuthController.resendVerification);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

// Protected routes
router.get(
  "/profile",
  AuthMiddleware.authenticateToken,
  AuthController.getProfile
);
router.put(
  "/profile",
  AuthMiddleware.authenticateToken,
  AuthController.updateProfile
);
router.post("/logout", AuthMiddleware.authenticateToken, AuthController.logout);

module.exports = router;
