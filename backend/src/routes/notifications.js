const express = require("express");
const { query, param, body, validationResult } = require("express-validator");

const auth = require("../middleware/auth");
const { NotificationService } = require("../services/notificationService");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get(
  "/",
  auth,
  [
    query("type")
      .optional()
      .isIn([
        "match_found",
        "claim_received",
        "claim_approved",
        "claim_rejected",
        "system_update",
      ])
      .withMessage("Invalid notification type"),
    query("isRead")
      .optional()
      .isBoolean()
      .withMessage("isRead must be boolean"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1-50"),
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

      const { type, isRead, page = 1, limit = 20 } = req.query;

      const options = {
        type,
        isRead: isRead !== undefined ? isRead === "true" : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const result = await NotificationService.getUserNotifications(
        req.userId,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Get notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
        code: "GET_NOTIFICATIONS_ERROR",
      });
    }
  }
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private
 */
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
      code: "GET_UNREAD_COUNT_ERROR",
    });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  "/:id/read",
  auth,
  [param("id").isUUID().withMessage("Invalid notification ID")],
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

      const { id } = req.params;
      const success = await NotificationService.markAsRead(id, req.userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
          code: "NOTIFICATION_NOT_FOUND",
        });
      }

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      logger.error("Mark notification as read error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
        code: "MARK_READ_ERROR",
      });
    }
  }
);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/mark-all-read", auth, async (req, res) => {
  try {
    const updatedCount = await NotificationService.markAllAsRead(req.userId);

    res.json({
      success: true,
      message: `${updatedCount} notifications marked as read`,
      data: { updatedCount },
    });
  } catch (error) {
    logger.error("Mark all notifications as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      code: "MARK_ALL_READ_ERROR",
    });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification
 * @access  Private
 */
router.post(
  "/test",
  auth,
  [
    body("includeWhatsApp")
      .optional()
      .isBoolean()
      .withMessage("includeWhatsApp must be boolean"),
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

      const { includeWhatsApp = false } = req.body;

      const result = await NotificationService.sendTestNotification(
        req.userId,
        includeWhatsApp
      );

      res.json({
        success: true,
        message: "Test notification sent successfully",
        data: {
          notificationId: result.notification.id,
          whatsappSent: result.whatsappSent,
        },
      });
    } catch (error) {
      logger.error("Send test notification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send test notification",
        code: "SEND_TEST_ERROR",
      });
    }
  }
);

module.exports = router;
