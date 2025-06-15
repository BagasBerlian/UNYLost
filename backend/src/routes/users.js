const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const multer = require("multer");

const { User, LostItem, FoundItem, Claim, Match } = require("../models");
const auth = require("../middleware/auth");
const logger = require("../utils/logger");
const { FileService } = require("../services/fileService");

const router = express.Router();

// Multer configuration for profile picture upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for profile pictures"), false);
    }
  },
});

// Validation rules
const updateProfileValidation = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2-100 characters"),
  body("whatsappNumber")
    .optional()
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/)
    .withMessage("Valid Indonesian WhatsApp number is required"),
  body("notificationSettings")
    .optional()
    .isObject()
    .withMessage("Notification settings must be an object"),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Password confirmation does not match");
    }
    return true;
  }),
];

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile with statistics
 * @access  Private
 */
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: LostItem,
          as: "lostItems",
          attributes: ["id", "status"],
          separate: true,
        },
        {
          model: FoundItem,
          as: "foundItems",
          attributes: ["id", "status"],
          separate: true,
        },
        {
          model: Claim,
          as: "claims",
          attributes: ["id", "status"],
          separate: true,
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Calculate statistics
    const stats = {
      lostItems: {
        total: user.lostItems.length,
        active: user.lostItems.filter((item) => item.status === "active")
          .length,
        hasMatches: user.lostItems.filter(
          (item) => item.status === "has_matches"
        ).length,
        resolved: user.lostItems.filter((item) => item.status === "resolved")
          .length,
      },
      foundItems: {
        total: user.foundItems.length,
        available: user.foundItems.filter((item) => item.status === "available")
          .length,
        pendingClaim: user.foundItems.filter(
          (item) => item.status === "pending_claim"
        ).length,
        claimed: user.foundItems.filter((item) => item.status === "claimed")
          .length,
      },
      claims: {
        total: user.claims.length,
        pending: user.claims.filter((claim) => claim.status === "pending")
          .length,
        approved: user.claims.filter((claim) => claim.status === "approved")
          .length,
        rejected: user.claims.filter((claim) => claim.status === "rejected")
          .length,
      },
    };

    // Get match statistics
    const matchStats = await Match.findAll({
      include: [
        {
          model: LostItem,
          as: "lostItem",
          where: { userId: req.userId },
          attributes: [],
        },
      ],
      attributes: ["similarity", "status"],
      raw: true,
    });

    stats.matches = {
      total: matchStats.length,
      highSimilarity: matchStats.filter((match) => match.similarity >= 0.8)
        .length,
      pending: matchStats.filter((match) => match.status === "pending").length,
    };

    // Remove the arrays from user object (we only needed them for stats)
    const userData = user.toJSON();
    delete userData.lostItems;
    delete userData.foundItems;
    delete userData.claims;

    res.json({
      success: true,
      data: {
        user: userData,
        statistics: stats,
      },
    });
  } catch (error) {
    logger.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      code: "GET_PROFILE_ERROR",
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", auth, updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { fullName, whatsappNumber, notificationSettings } = req.body;

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Prepare update data
    const updateData = {};

    if (fullName !== undefined) {
      updateData.fullName = fullName.trim();
    }

    if (whatsappNumber !== undefined) {
      // Normalize WhatsApp number
      let normalized = whatsappNumber.replace(/\s|-|\(|\)/g, "");
      if (normalized.startsWith("0")) {
        normalized = "+62" + normalized.substring(1);
      } else if (normalized.startsWith("62")) {
        normalized = "+" + normalized;
      } else if (!normalized.startsWith("+62")) {
        normalized = "+62" + normalized;
      }

      // Check if number is already used by another user
      const existingUser = await User.findOne({
        where: {
          whatsappNumber: normalized,
          id: { [require("sequelize").Op.ne]: req.userId },
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "WhatsApp number already used by another user",
          code: "WHATSAPP_EXISTS",
        });
      }

      updateData.whatsappNumber = normalized;

      // Re-verify WhatsApp if number changed
      if (user.whatsappNumber !== normalized) {
        const { WhatsAppService } = require("../services/whatsappService");
        const verification = await WhatsAppService.verifyNumber(normalized);
        updateData.isWhatsappVerified =
          verification.isValid && verification.isRegistered;
      }
    }

    if (notificationSettings !== undefined) {
      // Merge with existing settings
      updateData.notificationSettings = {
        ...user.notificationSettings,
        ...notificationSettings,
      };
    }

    // Update user
    await user.update(updateData);

    // Get updated user data
    const updatedUser = await User.findByPk(req.userId, {
      attributes: { exclude: ["password"] },
    });

    logger.info(`User profile updated: ${req.userId}`);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: updatedUser },
    });
  } catch (error) {
    logger.error("Update user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      code: "UPDATE_PROFILE_ERROR",
    });
  }
});

/**
 * @route   PUT /api/users/profile-picture
 * @desc    Update user profile picture
 * @access  Private
 */
router.put(
  "/profile-picture",
  auth,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Profile picture file is required",
          code: "NO_FILE",
        });
      }

      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Upload new profile picture
      const imageUrl = await FileService.uploadImage(req.file, "profile");

      // Delete old profile picture if exists
      if (user.profilePicture) {
        try {
          const fileId = FileService.extractFileIdFromUrl(user.profilePicture);
          if (fileId) {
            await FileService.deleteFromDrive(fileId);
          }
        } catch (deleteError) {
          logger.warn(
            "Failed to delete old profile picture:",
            deleteError.message
          );
        }
      }

      // Update user profile picture
      await user.update({ profilePicture: imageUrl });

      logger.info(`Profile picture updated for user: ${req.userId}`);

      res.json({
        success: true,
        message: "Profile picture updated successfully",
        data: { profilePicture: imageUrl },
      });
    } catch (error) {
      logger.error("Update profile picture error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile picture",
        code: "UPDATE_PICTURE_ERROR",
      });
    }
  }
);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  "/change-password",
  auth,
  changePasswordValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await user.update({ password: hashedNewPassword });

      logger.info(`Password changed for user: ${req.userId}`);

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        code: "CHANGE_PASSWORD_ERROR",
      });
    }
  }
);

/**
 * @route   PUT /api/users/notification-settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put(
  "/notification-settings",
  auth,
  [
    body("settings")
      .isObject()
      .withMessage("Settings must be an object")
      .custom((settings) => {
        const allowedKeys = [
          "matchFound",
          "claimReceived",
          "claimStatusChanged",
          "systemUpdates",
        ];
        const providedKeys = Object.keys(settings);

        for (const key of providedKeys) {
          if (!allowedKeys.includes(key)) {
            throw new Error(`Invalid setting key: ${key}`);
          }
          if (typeof settings[key] !== "boolean") {
            throw new Error(`Setting ${key} must be boolean`);
          }
        }

        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { settings } = req.body;

      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Merge with existing settings
      const updatedSettings = {
        ...user.notificationSettings,
        ...settings,
      };

      await user.update({ notificationSettings: updatedSettings });

      logger.info(`Notification settings updated for user: ${req.userId}`);

      res.json({
        success: true,
        message: "Notification settings updated successfully",
        data: { notificationSettings: updatedSettings },
      });
    } catch (error) {
      logger.error("Update notification settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update notification settings",
        code: "UPDATE_SETTINGS_ERROR",
      });
    }
  }
);

/**
 * @route   DELETE /api/users/account
 * @desc    Deactivate user account (soft delete)
 * @access  Private
 */
router.delete(
  "/account",
  auth,
  [
    body("password")
      .notEmpty()
      .withMessage("Password is required for account deactivation"),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Reason must be less than 500 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { password, reason } = req.body;

      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Password is incorrect",
          code: "INVALID_PASSWORD",
        });
      }

      // Deactivate account (soft delete)
      await user.update({
        isActive: false,
        // Store deactivation info (you might want to add these fields to User model)
        // deactivatedAt: new Date(),
        // deactivationReason: reason
      });

      // Update status of user's items to expired
      await LostItem.update(
        { status: "expired" },
        { where: { userId: req.userId, status: ["active", "has_matches"] } }
      );

      await FoundItem.update(
        { status: "expired" },
        {
          where: { userId: req.userId, status: ["available", "pending_claim"] },
        }
      );

      logger.info(
        `User account deactivated: ${req.userId}, reason: ${
          reason || "No reason provided"
        }`
      );

      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      logger.error("Deactivate account error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate account",
        code: "DEACTIVATE_ACCOUNT_ERROR",
      });
    }
  }
);

module.exports = router;
