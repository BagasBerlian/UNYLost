const { Notification } = require("../models");
const { WhatsAppService } = require("./whatsappService");
const logger = require("../utils/logger");

class NotificationService {
  constructor() {
    this.whatsapp = WhatsAppService;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Send match found notification
   */
  async sendMatchFoundNotification(user, foundItem, match) {
    try {
      // Check if user wants this type of notification
      if (!user.notificationSettings?.matchFound) {
        logger.info(`User ${user.id} has disabled match found notifications`);
        return false;
      }

      // Create in-app notification
      const notification = await Notification.create({
        userId: user.id,
        type: "match_found",
        title: "Match Ditemukan!",
        message: `Barang yang ${Math.round(
          match.similarity * 100
        )}% mirip dengan yang Anda hilangkan telah ditemukan.`,
        data: {
          matchId: match.id,
          foundItemId: foundItem.id,
          similarity: match.similarity,
          itemName: foundItem.itemName,
          location: foundItem.locationFound,
          foundDate: foundItem.foundDate,
          foundTime: foundItem.foundTime,
        },
      });

      // Send WhatsApp notification if user is verified
      let whatsappSent = false;
      if (user.isWhatsappVerified && user.whatsappNumber) {
        try {
          whatsappSent = await this.whatsapp.sendMatchFoundNotification(
            user.whatsappNumber,
            foundItem.itemName,
            match.similarity,
            foundItem.locationFound
          );

          if (whatsappSent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
          }
        } catch (whatsappError) {
          logger.warn("WhatsApp notification failed:", whatsappError.message);
        }
      }

      logger.info(
        `Match found notification sent to user ${user.id} (WhatsApp: ${whatsappSent})`
      );
      return true;
    } catch (error) {
      logger.error("Send match found notification error:", error);
      return false;
    }
  }

  /**
   * Send claim received notification
   */
  async sendClaimReceivedNotification(finder, foundItem, claim, claimer) {
    try {
      // Check if user wants this type of notification
      if (!finder.notificationSettings?.claimReceived) {
        logger.info(
          `User ${finder.id} has disabled claim received notifications`
        );
        return false;
      }

      // Create in-app notification
      const notification = await Notification.create({
        userId: finder.id,
        type: "claim_received",
        title: "Klaim Baru!",
        message: `${claimer.fullName} mengklaim barang temuan Anda: ${foundItem.itemName}`,
        data: {
          claimId: claim.id,
          foundItemId: foundItem.id,
          claimerId: claimer.id,
          claimerName: claimer.fullName,
          claimerEmail: claimer.email,
          itemName: foundItem.itemName,
          claimStory: claim.story,
          claimDate: claim.createdAt,
        },
      });

      // Send WhatsApp notification if user is verified
      let whatsappSent = false;
      if (finder.isWhatsappVerified && finder.whatsappNumber) {
        try {
          whatsappSent = await this.whatsapp.sendClaimReceivedNotification(
            finder.whatsappNumber,
            foundItem.itemName,
            claimer.fullName
          );

          if (whatsappSent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
          }
        } catch (whatsappError) {
          logger.warn("WhatsApp notification failed:", whatsappError.message);
        }
      }

      logger.info(
        `Claim received notification sent to user ${finder.id} (WhatsApp: ${whatsappSent})`
      );
      return true;
    } catch (error) {
      logger.error("Send claim received notification error:", error);
      return false;
    }
  }

  /**
   * Send claim approved notification
   */
  async sendClaimApprovedNotification(claimer, foundItem, claim, finder) {
    try {
      // Check if user wants this type of notification
      if (!claimer.notificationSettings?.claimStatusChanged) {
        logger.info(
          `User ${claimer.id} has disabled claim status notifications`
        );
        return false;
      }

      // Create in-app notification
      const notification = await Notification.create({
        userId: claimer.id,
        type: "claim_approved",
        title: "Klaim Disetujui!",
        message: `Klaim Anda untuk ${foundItem.itemName} telah disetujui.`,
        data: {
          claimId: claim.id,
          foundItemId: foundItem.id,
          finderId: finder.id,
          finderName: finder.fullName,
          finderPhone: finder.whatsappNumber,
          finderEmail: finder.email,
          itemName: foundItem.itemName,
          locationFound: foundItem.locationFound,
          approvedAt: claim.reviewedAt,
          handoverDetails: claim.handoverDetails,
        },
      });

      // Send WhatsApp notification if user is verified
      let whatsappSent = false;
      if (claimer.isWhatsappVerified && claimer.whatsappNumber) {
        try {
          whatsappSent = await this.whatsapp.sendClaimApprovedNotification(
            claimer.whatsappNumber,
            foundItem.itemName,
            finder.fullName,
            finder.whatsappNumber
          );

          if (whatsappSent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
          }
        } catch (whatsappError) {
          logger.warn("WhatsApp notification failed:", whatsappError.message);
        }
      }

      logger.info(
        `Claim approved notification sent to user ${claimer.id} (WhatsApp: ${whatsappSent})`
      );
      return true;
    } catch (error) {
      logger.error("Send claim approved notification error:", error);
      return false;
    }
  }

  /**
   * Send claim rejected notification
   */
  async sendClaimRejectedNotification(claimer, foundItem, claim, reason) {
    try {
      // Check if user wants this type of notification
      if (!claimer.notificationSettings?.claimStatusChanged) {
        logger.info(
          `User ${claimer.id} has disabled claim status notifications`
        );
        return false;
      }

      // Create in-app notification
      const notification = await Notification.create({
        userId: claimer.id,
        type: "claim_rejected",
        title: "Klaim Ditolak",
        message: `Klaim Anda untuk ${foundItem.itemName} ditolak.`,
        data: {
          claimId: claim.id,
          foundItemId: foundItem.id,
          itemName: foundItem.itemName,
          reason: reason,
          rejectedAt: claim.reviewedAt,
          originalStory: claim.story,
        },
      });

      // Send WhatsApp notification if user is verified
      let whatsappSent = false;
      if (claimer.isWhatsappVerified && claimer.whatsappNumber) {
        try {
          whatsappSent = await this.whatsapp.sendClaimRejectedNotification(
            claimer.whatsappNumber,
            foundItem.itemName,
            reason
          );

          if (whatsappSent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
          }
        } catch (whatsappError) {
          logger.warn("WhatsApp notification failed:", whatsappError.message);
        }
      }

      logger.info(
        `Claim rejected notification sent to user ${claimer.id} (WhatsApp: ${whatsappSent})`
      );
      return true;
    } catch (error) {
      logger.error("Send claim rejected notification error:", error);
      return false;
    }
  }

  /**
   * Send item status update notification
   */
  async sendItemStatusUpdateNotification(
    user,
    item,
    oldStatus,
    newStatus,
    itemType = "item"
  ) {
    try {
      if (!user.notificationSettings?.systemUpdates) {
        return false;
      }

      const statusMessages = {
        active: "aktif",
        has_matches: "memiliki kecocokan",
        resolved: "telah diselesaikan",
        expired: "telah kedaluwarsa",
        available: "tersedia",
        pending_claim: "sedang diklaim",
        claimed: "telah diklaim",
      };

      const notification = await Notification.create({
        userId: user.id,
        type: "system_update",
        title: "Status Barang Diperbarui",
        message: `Status ${itemType} "${item.itemName}" berubah dari ${statusMessages[oldStatus]} menjadi ${statusMessages[newStatus]}.`,
        data: {
          itemId: item.id,
          itemType,
          itemName: item.itemName,
          oldStatus,
          newStatus,
          updatedAt: new Date().toISOString(),
        },
      });

      logger.info(`Item status update notification sent to user ${user.id}`);
      return true;
    } catch (error) {
      logger.error("Send item status update notification error:", error);
      return false;
    }
  }

  /**
   * Send system maintenance notification
   */
  async sendMaintenanceNotification(
    userIds,
    title,
    message,
    scheduledTime,
    estimatedDuration
  ) {
    try {
      const notifications = [];

      for (const userId of userIds) {
        const notification = await Notification.create({
          userId,
          type: "system_update",
          title,
          message,
          data: {
            maintenanceType: "scheduled",
            scheduledTime,
            estimatedDuration,
            createdAt: new Date().toISOString(),
          },
        });

        notifications.push(notification);
      }

      logger.info(`Maintenance notification sent to ${userIds.length} users`);
      return notifications;
    } catch (error) {
      logger.error("Send maintenance notification error:", error);
      return [];
    }
  }

  /**
   * Send bulk notification to multiple users
   */
  async sendBulkNotification(
    userIds,
    type,
    title,
    message,
    data = {},
    includeWhatsApp = false
  ) {
    try {
      const notifications = [];
      const whatsappResults = [];

      for (const userId of userIds) {
        try {
          // Create in-app notification
          const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            data: {
              ...data,
              isBulk: true,
              sentAt: new Date().toISOString(),
            },
          });

          notifications.push(notification);

          // Send WhatsApp if requested
          if (includeWhatsApp) {
            const { User } = require("../models");
            const user = await User.findByPk(userId, {
              attributes: [
                "whatsappNumber",
                "isWhatsappVerified",
                "notificationSettings",
              ],
            });

            if (
              user &&
              user.isWhatsappVerified &&
              user.whatsappNumber &&
              user.notificationSettings?.systemUpdates
            ) {
              try {
                const whatsappSent = await this.whatsapp.sendMessage(
                  user.whatsappNumber,
                  `📢 *${title}*\n\n${message}`
                );

                whatsappResults.push({
                  userId,
                  phone: user.whatsappNumber,
                  sent: whatsappSent,
                });

                if (whatsappSent) {
                  await notification.update({
                    whatsappSent: true,
                    whatsappSentAt: new Date(),
                  });
                }
              } catch (whatsappError) {
                logger.warn(
                  `WhatsApp bulk notification failed for user ${userId}:`,
                  whatsappError.message
                );
                whatsappResults.push({
                  userId,
                  sent: false,
                  error: whatsappError.message,
                });
              }
            }
          }
        } catch (notificationError) {
          logger.error(
            `Failed to send notification to user ${userId}:`,
            notificationError
          );
        }
      }

      logger.info(
        `Bulk notification sent: ${notifications.length} in-app, ${
          whatsappResults.filter((r) => r.sent).length
        } WhatsApp`
      );

      return {
        notifications,
        whatsappResults,
        summary: {
          totalUsers: userIds.length,
          inAppSent: notifications.length,
          whatsappSent: whatsappResults.filter((r) => r.sent).length,
          whatsappFailed: whatsappResults.filter((r) => !r.sent).length,
        },
      };
    } catch (error) {
      logger.error("Send bulk notification error:", error);
      return {
        notifications: [],
        whatsappResults: [],
        summary: {
          totalUsers: 0,
          inAppSent: 0,
          whatsappSent: 0,
          whatsappFailed: 0,
        },
      };
    }
  }

  /**
   * Send system update notification
   */
  async sendSystemNotification(userIds, title, message, data = {}) {
    try {
      return await this.sendBulkNotification(
        userIds,
        "system_update",
        title,
        message,
        data
      );
    } catch (error) {
      logger.error("Send system notification error:", error);
      return [];
    }
  }

  /**
   * Send reminder notification for pending claims
   */
  async sendClaimReminderNotification(
    finder,
    foundItem,
    claim,
    daysSinceClaim
  ) {
    try {
      if (!finder.notificationSettings?.claimReceived) {
        return false;
      }

      const notification = await Notification.create({
        userId: finder.id,
        type: "system_update",
        title: "Pengingat Klaim Pending",
        message: `Anda memiliki klaim untuk "${foundItem.itemName}" yang belum direspon selama ${daysSinceClaim} hari.`,
        data: {
          claimId: claim.id,
          foundItemId: foundItem.id,
          itemName: foundItem.itemName,
          daysSinceClaim,
          reminderType: "claim_pending",
          claimCreatedAt: claim.createdAt,
        },
      });

      // Send WhatsApp reminder
      let whatsappSent = false;
      if (finder.isWhatsappVerified && finder.whatsappNumber) {
        try {
          const reminderMessage = `🔔 *UNY Lost - Pengingat Klaim*\n\nAnda memiliki klaim untuk "${foundItem.itemName}" yang belum direspon selama ${daysSinceClaim} hari.\n\nSilakan buka aplikasi untuk mereview klaim tersebut.\n\n_Pesan pengingat otomatis_`;

          whatsappSent = await this.whatsapp.sendMessage(
            finder.whatsappNumber,
            reminderMessage
          );

          if (whatsappSent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
          }
        } catch (whatsappError) {
          logger.warn("WhatsApp reminder failed:", whatsappError.message);
        }
      }

      logger.info(
        `Claim reminder sent to user ${finder.id} (${daysSinceClaim} days old)`
      );
      return true;
    } catch (error) {
      logger.error("Send claim reminder notification error:", error);
      return false;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await notification.update({ isRead: true });

      logger.debug(`Notification marked as read: ${notificationId}`);
      return true;
    } catch (error) {
      logger.error("Mark notification as read error:", error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId) {
    try {
      const [updatedCount] = await Notification.update(
        { isRead: true },
        {
          where: {
            userId,
            isRead: false,
          },
        }
      );

      logger.info(
        `Marked ${updatedCount} notifications as read for user ${userId}`
      );
      return updatedCount;
    } catch (error) {
      logger.error("Mark all notifications as read error:", error);
      return 0;
    }
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const {
        type,
        isRead,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "DESC",
      } = options;

      const offset = (page - 1) * limit;
      const where = { userId };

      if (type) where.type = type;
      if (typeof isRead === "boolean") where.isRead = isRead;

      const { count, rows: notifications } = await Notification.findAndCountAll(
        {
          where,
          order: [[sortBy, sortOrder.toUpperCase()]],
          limit: parseInt(limit),
          offset: parseInt(offset),
        }
      );

      return {
        notifications,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
          hasNext: page < Math.ceil(count / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Get user notifications error:", error);
      return {
        notifications: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      logger.error("Get unread count error:", error);
      return 0;
    }
  }

  /**
   * Get unread count by type for user
   */
  async getUnreadCountByType(userId) {
    try {
      const { Op } = require("sequelize");
      const notifications = await Notification.findAll({
        where: {
          userId,
          isRead: false,
        },
        attributes: ["type"],
        raw: true,
      });

      const countByType = {};
      notifications.forEach((notification) => {
        countByType[notification.type] =
          (countByType[notification.type] || 0) + 1;
      });

      return countByType;
    } catch (error) {
      logger.error("Get unread count by type error:", error);
      return {};
    }
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(maxAge = 30 * 24 * 60 * 60 * 1000) {
    // 30 days
    try {
      const { Op } = require("sequelize");
      const cutoffDate = new Date(Date.now() - maxAge);

      const deletedCount = await Notification.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(`Deleted ${deletedCount} old notifications`);
      return deletedCount;
    } catch (error) {
      logger.error("Delete old notifications error:", error);
      return 0;
    }
  }

  /**
   * Delete notifications for specific user
   */
  async deleteUserNotifications(userId, olderThanDays = 30) {
    try {
      const { Op } = require("sequelize");
      const cutoffDate = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      );

      const deletedCount = await Notification.destroy({
        where: {
          userId,
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(
        `Deleted ${deletedCount} old notifications for user ${userId}`
      );
      return deletedCount;
    } catch (error) {
      logger.error("Delete user notifications error:", error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   */
  async getStats() {
    try {
      const { Op } = require("sequelize");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        total: await Notification.count(),
        unread: await Notification.count({ where: { isRead: false } }),
        todayCount: await Notification.count({
          where: {
            createdAt: {
              [Op.gte]: today,
            },
          },
        }),
        whatsappSent: await Notification.count({
          where: { whatsappSent: true },
        }),
        byType: {},
        byStatus: {
          read: await Notification.count({ where: { isRead: true } }),
          unread: await Notification.count({ where: { isRead: false } }),
        },
      };

      // Count by type
      const typeStats = await Notification.findAll({
        attributes: ["type", [require("sequelize").fn("COUNT", "*"), "count"]],
        group: ["type"],
        raw: true,
      });

      typeStats.forEach((stat) => {
        stats.byType[stat.type] = parseInt(stat.count);
      });

      // Calculate delivery rate
      stats.deliveryRate = {
        whatsappSuccessRate: stats.whatsappSent / stats.total,
        totalDelivered: stats.total,
        whatsappDelivered: stats.whatsappSent,
      };

      return stats;
    } catch (error) {
      logger.error("Get notification stats error:", error);
      return {
        total: 0,
        unread: 0,
        todayCount: 0,
        whatsappSent: 0,
        byType: {},
        byStatus: { read: 0, unread: 0 },
        deliveryRate: {
          whatsappSuccessRate: 0,
          totalDelivered: 0,
          whatsappDelivered: 0,
        },
      };
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(userId, includeWhatsApp = false) {
    try {
      // Create test notification
      const notification = await Notification.create({
        userId,
        type: "system_update",
        title: "Test Notification",
        message: "This is a test notification from UNY Lost system.",
        data: {
          isTest: true,
          timestamp: new Date().toISOString(),
          testType: includeWhatsApp ? "full_test" : "app_only_test",
        },
      });

      // Send WhatsApp test if requested
      let whatsappSent = false;
      if (includeWhatsApp) {
        const { User } = require("../models");
        const user = await User.findByPk(userId);

        if (user && user.isWhatsappVerified && user.whatsappNumber) {
          try {
            const testMessage = `🧪 *UNY Lost - Test Notification*\n\nHi ${
              user.fullName
            }!\n\nThis is a test message to verify that WhatsApp notifications are working correctly.\n\n_Test sent at ${new Date().toLocaleString(
              "id-ID"
            )}_`;

            whatsappSent = await this.whatsapp.sendMessage(
              user.whatsappNumber,
              testMessage
            );

            if (whatsappSent) {
              await notification.update({
                whatsappSent: true,
                whatsappSentAt: new Date(),
              });
            }
          } catch (whatsappError) {
            logger.warn(
              "Test WhatsApp notification failed:",
              whatsappError.message
            );
          }
        }
      }

      logger.info(
        `Test notification sent to user ${userId} (WhatsApp: ${whatsappSent})`
      );
      return { notification, whatsappSent };
    } catch (error) {
      logger.error("Send test notification error:", error);
      throw error;
    }
  }

  /**
   * Retry failed WhatsApp notifications
   */
  async retryFailedWhatsAppNotifications(maxRetries = 3) {
    try {
      const { Op } = require("sequelize");

      // Get notifications that failed WhatsApp delivery in last 24 hours
      const failedNotifications = await Notification.findAll({
        where: {
          whatsappSent: false,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        include: [
          {
            model: require("../models").User,
            as: "user",
            attributes: [
              "id",
              "whatsappNumber",
              "isWhatsappVerified",
              "fullName",
            ],
            where: {
              isWhatsappVerified: true,
              whatsappNumber: { [Op.ne]: null },
            },
          },
        ],
        limit: 50, // Process max 50 at a time
      });

      let successCount = 0;
      let failCount = 0;

      for (const notification of failedNotifications) {
        try {
          let message = `📢 *${notification.title}*\n\n${notification.message}`;

          // Add context based on notification type
          if (notification.type === "match_found") {
            message += "\n\nBuka aplikasi UNY Lost untuk melihat detail match.";
          } else if (notification.type === "claim_received") {
            message += "\n\nSilakan review klaim di aplikasi UNY Lost.";
          }

          const sent = await this.whatsapp.sendMessage(
            notification.user.whatsappNumber,
            message
          );

          if (sent) {
            await notification.update({
              whatsappSent: true,
              whatsappSentAt: new Date(),
            });
            successCount++;
          } else {
            failCount++;
          }

          // Add delay between sends
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (retryError) {
          logger.warn(
            `Retry failed for notification ${notification.id}:`,
            retryError.message
          );
          failCount++;
        }
      }

      logger.info(
        `WhatsApp retry completed: ${successCount} sent, ${failCount} failed`
      );

      return {
        processed: failedNotifications.length,
        success: successCount,
        failed: failCount,
      };
    } catch (error) {
      logger.error("Retry failed WhatsApp notifications error:", error);
      return { processed: 0, success: 0, failed: 0 };
    }
  }

  /**
   * Get notification preferences for user
   */
  async getUserPreferences(userId) {
    try {
      const { User } = require("../models");
      const user = await User.findByPk(userId, {
        attributes: [
          "notificationSettings",
          "isWhatsappVerified",
          "whatsappNumber",
        ],
      });

      if (!user) {
        throw new Error("User not found");
      }

      return {
        inApp: user.notificationSettings || {
          matchFound: true,
          claimReceived: true,
          claimStatusChanged: true,
          systemUpdates: false,
        },
        whatsapp: {
          enabled: user.isWhatsappVerified && !!user.whatsappNumber,
          phoneNumber: user.whatsappNumber,
        },
      };
    } catch (error) {
      logger.error("Get user notification preferences error:", error);
      return {
        inApp: {
          matchFound: true,
          claimReceived: true,
          claimStatusChanged: true,
          systemUpdates: false,
        },
        whatsapp: { enabled: false, phoneNumber: null },
      };
    }
  }

  /**
   * Update notification preferences for user
   */
  async updateUserPreferences(userId, preferences) {
    try {
      const { User } = require("../models");
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error("User not found");
      }

      const updatedSettings = {
        ...user.notificationSettings,
        ...preferences,
      };

      await user.update({ notificationSettings: updatedSettings });

      logger.info(`Notification preferences updated for user ${userId}`);
      return updatedSettings;
    } catch (error) {
      logger.error("Update user notification preferences error:", error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = { NotificationService: new NotificationService() };
