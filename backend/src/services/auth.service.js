const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const config = require("../config/app");
const { Op } = require("sequelize");
const EmailService = require("./email.service");

class AuthService {
  async registerUser(userData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: userData.email },
            { whatsappNumber: userData.whatsappNumber },
          ],
        },
      });

      if (existingUser) {
        throw new Error(
          "User with this email or WhatsApp number already exists"
        );
      }

      // Create new user
      const user = await User.create({
        ...userData,
        password: userData.password, // Will be hashed by model hook
      });

      // Generate verification code
      const verificationCode = user.generateVerificationCode();
      await user.save();

      // Send verification email
      await EmailService.sendVerificationEmail(
        user.email,
        user.firstName,
        verificationCode
      );

      return user;
    } catch (error) {
      throw error;
    }
  }

  async verifyUserEmail(email, code) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.verified) {
        throw new Error("Email already verified");
      }

      if (user.verificationCode !== code) {
        throw new Error("Invalid verification code");
      }

      if (user.isVerificationCodeExpired()) {
        throw new Error("Verification code expired");
      }

      // Update user
      user.verified = true;
      user.verifiedAt = new Date();
      user.verificationCode = null;
      await user.save();

      // Send welcome email
      await EmailService.sendWelcomeEmail(user.email, user.firstName);

      return true;
    } catch (error) {
      throw error;
    }
  }

  async authenticateUser(email, password) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.verified) {
        throw new Error("Email not verified");
      }

      if (!user.validatePassword(password)) {
        throw new Error("Invalid password");
      }

      // Update last login
      await user.updateLastLogin();

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return {
        user: user.toSafeJSON(),
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationCode(email) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.verified) {
        throw new Error("Email already verified");
      }

      // Generate new verification code
      const verificationCode = user.generateVerificationCode();
      await user.save();

      // Send verification email
      await EmailService.sendVerificationEmail(
        user.email,
        user.firstName,
        verificationCode
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(email) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new Error("User not found");
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user.id, purpose: "password_reset" },
        config.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Send password reset email
      const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await EmailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetLink
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.validatePassword(oldPassword)) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      user.password = newPassword;
      await user.save();

      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();
