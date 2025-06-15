const cron = require("node-cron");
const { AIService } = require("./aiService");
const { NotificationService } = require("./notificationService");
const { FileService } = require("./fileService");
const { LostItem, FoundItem, Match, User } = require("../models");
const logger = require("../utils/logger");

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Setup all cron jobs
   */
  setupCronJobs() {
    try {
      // Background AI matching - every 2 hours
      this.scheduleBackgroundMatching();

      // Cleanup old notifications - daily at 2 AM
      this.scheduleNotificationCleanup();

      // Cleanup old files - daily at 3 AM
      this.scheduleFileCleanup();

      // Update item statuses - daily at 4 AM
      this.scheduleStatusUpdates();

      // Health check - every 30 minutes
      this.scheduleHealthCheck();

      this.isRunning = true;
      logger.info("✅ All cron jobs scheduled successfully");
    } catch (error) {
      logger.error("❌ Failed to setup cron jobs:", error);
    }
  }

  /**
   * Background AI matching job - every 2 hours
   */
  scheduleBackgroundMatching() {
    const job = cron.schedule(
      "0 */2 * * *",
      async () => {
        logger.info("🤖 Starting background AI matching...");

        try {
          // Check if AI service is available
          const isAIAvailable = await AIService.isAvailable();
          if (!isAIAvailable) {
            logger.warn(
              "AI service not available, skipping background matching"
            );
            return;
          }

          // Run background matching
          const result = await AIService.runBackgroundMatching({
            limit: 100,
            threshold: 0.75,
          });

          logger.info(
            `✅ Background matching completed: ${result.matches_found} matches found`
          );

          // Process new matches
          if (result.matches_found > 0) {
            await this.processNewMatches();
          }
        } catch (error) {
          logger.error("❌ Background matching error:", error);
        }
      },
      {
        scheduled: false,
        timezone: "Asia/Jakarta",
      }
    );

    this.jobs.set("backgroundMatching", job);
    job.start();
    logger.info("📅 Background matching scheduled (every 2 hours)");
  }

  /**
   * Process new matches from background service
   */
  async processNewMatches() {
    try {
      // Get recent matches that haven't been processed for notifications
      const { Op } = require("sequelize");
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const newMatches = await Match.findAll({
        where: {
          detectedAt: {
            [Op.gte]: fiveMinutesAgo,
          },
          notificationSent: false,
          similarity: {
            [Op.gte]: 0.75, // Only matches above threshold
          },
        },
        include: [
          {
            model: LostItem,
            as: "lostItem",
            include: [
              {
                model: User,
                as: "owner",
                attributes: [
                  "id",
                  "whatsappNumber",
                  "notificationSettings",
                  "isWhatsappVerified",
                ],
              },
            ],
          },
          {
            model: FoundItem,
            as: "foundItem",
            attributes: ["id", "itemName", "locationFound"],
          },
        ],
      });

      logger.info(
        `Processing ${newMatches.length} new matches for notifications`
      );

      for (const match of newMatches) {
        try {
          // Send notification to lost item owner
          await NotificationService.sendMatchFoundNotification(
            match.lostItem.owner,
            match.foundItem,
            match
          );

          // Mark notification as sent
          await match.update({ notificationSent: true });

          // Update lost item status
          await match.lostItem.update({
            status: "has_matches",
            lastMatchedAt: new Date(),
          });
        } catch (notifError) {
          logger.error(`Error processing match ${match.id}:`, notifError);
        }
      }
    } catch (error) {
      logger.error("Process new matches error:", error);
    }
  }

  /**
   * Cleanup old notifications - daily at 2 AM
   */
  scheduleNotificationCleanup() {
    const job = cron.schedule(
      "0 2 * * *",
      async () => {
        logger.info("🧹 Starting notification cleanup...");

        try {
          const deletedCount = await NotificationService.deleteOldNotifications(
            30 * 24 * 60 * 60 * 1000 // 30 days
          );

          logger.info(
            `✅ Notification cleanup completed: ${deletedCount} old notifications deleted`
          );
        } catch (error) {
          logger.error("❌ Notification cleanup error:", error);
        }
      },
      {
        scheduled: false,
        timezone: "Asia/Jakarta",
      }
    );

    this.jobs.set("notificationCleanup", job);
    job.start();
    logger.info("📅 Notification cleanup scheduled (daily at 2 AM)");
  }

  /**
   * Cleanup old files - daily at 3 AM
   */
  scheduleFileCleanup() {
    const job = cron.schedule(
      "0 3 * * *",
      async () => {
        logger.info("📁 Starting file cleanup...");

        try {
          const deletedCount = await FileService.cleanupLocalFiles(
            7 * 24 * 60 * 60 * 1000 // 7 days
          );

          logger.info(
            `✅ File cleanup completed: ${deletedCount} old files deleted`
          );
        } catch (error) {
          logger.error("❌ File cleanup error:", error);
        }
      },
      {
        scheduled: false,
        timezone: "Asia/Jakarta",
      }
    );

    this.jobs.set("fileCleanup", job);
    job.start();
    logger.info("📅 File cleanup scheduled (daily at 3 AM)");
  }

  /**
   * Update item statuses - daily at 4 AM
   */
  scheduleStatusUpdates() {
    const job = cron.schedule(
      "0 4 * * *",
      async () => {
        logger.info("🔄 Starting status updates...");

        try {
          const { Op } = require("sequelize");
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          // Expire old items
          const expiredLost = await LostItem.update(
            { status: "expired" },
            {
              where: {
                status: ["active", "has_matches"],
                createdAt: {
                  [Op.lt]: thirtyDaysAgo,
                },
              },
            }
          );

          const expiredFound = await FoundItem.update(
            { status: "expired" },
            {
              where: {
                status: ["available", "pending_claim"],
                createdAt: {
                  [Op.lt]: thirtyDaysAgo,
                },
              },
            }
          );

          logger.info(
            `✅ Status updates completed: ${expiredLost[0]} lost items expired, ${expiredFound[0]} found items expired`
          );
        } catch (error) {
          logger.error("❌ Status updates error:", error);
        }
      },
      {
        scheduled: false,
        timezone: "Asia/Jakarta",
      }
    );

    this.jobs.set("statusUpdates", job);
    job.start();
    logger.info("📅 Status updates scheduled (daily at 4 AM)");
  }

  /**
   * Health check - every 30 minutes
   */
  scheduleHealthCheck() {
    const job = cron.schedule(
      "*/30 * * * *",
      async () => {
        try {
          // Check AI service health
          const aiHealth = await AIService.getHealthStatus();

          // Check database connection
          const { sequelize } = require("../config/database");
          await sequelize.authenticate();

          // Log health status
          if (aiHealth.status === "healthy") {
            logger.debug("💚 Health check passed - all services healthy");
          } else {
            logger.warn(
              "💛 Health check warning - AI service degraded:",
              aiHealth
            );
          }
        } catch (error) {
          logger.error("❤️‍🩹 Health check failed:", error);
        }
      },
      {
        scheduled: false,
        timezone: "Asia/Jakarta",
      }
    );

    this.jobs.set("healthCheck", job);
    job.start();
    logger.info("📅 Health check scheduled (every 30 minutes)");
  }

  /**
   * Stop all cron jobs
   */
  stopAllJobs() {
    try {
      for (const [name, job] of this.jobs.entries()) {
        job.stop();
        logger.info(`Stopped cron job: ${name}`);
      }

      this.jobs.clear();
      this.isRunning = false;
      logger.info("✅ All cron jobs stopped");
    } catch (error) {
      logger.error("❌ Error stopping cron jobs:", error);
    }
  }

  /**
   * Get job status
   */
  getJobStatus() {
    const status = {};

    for (const [name, job] of this.jobs.entries()) {
      status[name] = {
        running: job.running,
        scheduled: !!job.scheduled,
      };
    }

    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      jobs: status,
    };
  }

  /**
   * Manually trigger background matching
   */
  async triggerBackgroundMatching() {
    try {
      logger.info("🚀 Manually triggering background matching...");

      const result = await AIService.runBackgroundMatching({
        limit: 50, // Smaller limit for manual trigger
        threshold: 0.75,
      });

      if (result.matches_found > 0) {
        await this.processNewMatches();
      }

      logger.info(
        `✅ Manual background matching completed: ${result.matches_found} matches found`
      );
      return result;
    } catch (error) {
      logger.error("❌ Manual background matching error:", error);
      throw error;
    }
  }

  /**
   * Get cron job statistics
   */
  async getStats() {
    try {
      const { Op } = require("sequelize");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        backgroundMatching: {
          totalMatches: await Match.count(),
          todayMatches: await Match.count({
            where: {
              detectedAt: {
                [Op.gte]: today,
              },
            },
          }),
          pendingMatches: await Match.count({
            where: { status: "pending" },
          }),
        },
        items: {
          activeLostItems: await LostItem.count({
            where: { status: "active" },
          }),
          availableFoundItems: await FoundItem.count({
            where: { status: "available" },
          }),
          expiredItems:
            (await LostItem.count({
              where: { status: "expired" },
            })) +
            (await FoundItem.count({
              where: { status: "expired" },
            })),
        },
        notifications: await NotificationService.getStats(),
        jobs: this.getJobStatus(),
      };

      return stats;
    } catch (error) {
      logger.error("Get cron stats error:", error);
      return {
        backgroundMatching: {
          totalMatches: 0,
          todayMatches: 0,
          pendingMatches: 0,
        },
        items: { activeLostItems: 0, availableFoundItems: 0, expiredItems: 0 },
        notifications: { total: 0, unread: 0, todayCount: 0 },
        jobs: this.getJobStatus(),
      };
    }
  }
}

// Export singleton instance
const cronService = new CronService();

module.exports = {
  CronService: cronService,
  setupCronJobs: () => cronService.setupCronJobs(),
  stopAllJobs: () => cronService.stopAllJobs(),
  getJobStatus: () => cronService.getJobStatus(),
  triggerBackgroundMatching: () => cronService.triggerBackgroundMatching(),
  getStats: () => cronService.getStats(),
};
