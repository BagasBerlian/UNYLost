const jwt = require("jsonwebtoken");
const config = require("../../config/app");
const User = require("../../models/user.model");
const AuthService = require("../../services/auth.service");

class AuthController {
  async register(req, res, next) {
    try {
      const userData = req.body;
      const user = await AuthService.registerUser(userData);

      res.status(201).json({
        success: true,
        message:
          "Pendaftaran berhasil. Kode verifikasi telah dikirim ke email Anda.",
        data: {
          userId: user.id,
          email: user.email,
          verified: user.verified,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { email, code } = req.body;
      await AuthService.verifyUserEmail(email, code);

      res.status(200).json({
        success: true,
        message: "Email terverifikasi",
      });
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      await AuthService.resendVerificationCode(email);

      res.status(200).json({
        success: true,
        message: "Kode verifikasi baru telah dikirim ke email Anda",
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.authenticateUser(email, password);

      res.status(200).json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await AuthService.resetPassword(email);

      res.status(200).json({
        success: true,
        message: "Instruksi reset password telah dikirim ke email Anda",
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET);

      if (!decoded || decoded.purpose !== "password_reset") {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        });
      }

      // Get user
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password successfully reset",
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: req.user.toSafeJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const user = req.user;
      const updateData = req.body;

      // Filter out sensitive fields
      const allowedFields = [
        "firstName",
        "lastName",
        "notificationSettings",
        "profilePicture",
      ];
      Object.keys(updateData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });

      // Update user
      Object.assign(user, updateData);
      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: user.toSafeJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      // For JWT, we don't need to do anything server-side
      // The client should discard the token

      res.status(200).json({
        success: true,
        message: "Logout berhasil",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
