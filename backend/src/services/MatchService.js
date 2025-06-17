// File: backend/src/services/MatchService.js - Service untuk Handle AI Matches
const { Match, FoundItem, LostItem, User } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");
const NotificationService = require("./NotificationService");

class MatchService {
  /**
   * Create new match from AI results
   * @param {Object} matchData - Match data from AI
   * @returns {Promise<Object>} Created match
   */
  static async createMatch(matchData) {
    try {
      logger.info(
        `Creating match: ${matchData.foundItemId} <-> ${matchData.lostItemId}`
      );

      // Check if match already exists
      const existingMatch = await Match.findOne({
        where: {
          foundItemId: matchData.foundItemId,
          lostItemId: matchData.lostItemId,
        },
      });

      if (existingMatch) {
        logger.info(`Match already exists: ${existingMatch.id}`);
        return existingMatch;
      }

      // Create new match
      const match = await Match.create({
        foundItemId: matchData.foundItemId,
        lostItemId: matchData.lostItemId,
        similarity: matchData.similarity,
        aiGenerated: matchData.aiGenerated || true,
        status: "pending",
        matchedAt: new Date(),
      });

      // Update item statuses
      await this.updateItemStatusesForMatch(
        matchData.foundItemId,
        matchData.lostItemId
      );

      // Send notifications for high similarity matches
      if (matchData.similarity >= 0.8) {
        await this.sendMatchNotifications(match);
      }

      logger.info(`Match created successfully: ${match.id}`);
      return match;
    } catch (error) {
      logger.error(`Error creating match: ${error.message}`);
      throw new Error("Failed to create match");
    }
  }

  /**
   * Get matches for user items
   * @param {string} userId - User ID
   * @param {Object} filters - Filters (status, type, etc.)
   * @returns {Promise<Object>} Matches with pagination
   */
  static async getUserMatches(userId, filters = {}) {
    try {
      const { status, type, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      // Build where clause for matches
      let whereClause = {};
      if (status) {
        whereClause.status = status;
      }

      // Get user's items to filter matches
      const userFoundItems = await FoundItem.findAll({
        where: { userId },
        attributes: ["id"],
      });

      const userLostItems = await LostItem.findAll({
        where: { userId },
        attributes: ["id"],
      });

      const foundItemIds = userFoundItems.map((item) => item.id);
      const lostItemIds = userLostItems.map((item) => item.id);

      // Filter matches based on user's items
      if (type === "found") {
        whereClause.foundItemId = { [Op.in]: foundItemIds };
      } else if (type === "lost") {
        whereClause.lostItemId = { [Op.in]: lostItemIds };
      } else {
        whereClause[Op.or] = [
          { foundItemId: { [Op.in]: foundItemIds } },
          { lostItemId: { [Op.in]: lostItemIds } },
        ];
      }

      const matches = await Match.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [
          ["similarity", "DESC"],
          ["createdAt", "DESC"],
        ],
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            include: [
              {
                model: User,
                as: "finder",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
          {
            model: LostItem,
            as: "lostItem",
            include: [
              {
                model: User,
                as: "owner",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
        ],
      });

      // Process matches untuk response
      const processedMatches = matches.rows.map((match) => {
        const matchData = match.toJSON();

        // Determine user's role dalam match
        const isOwner = matchData.foundItem?.userId === userId;
        const isLostOwner = matchData.lostItem?.userId === userId;

        return {
          ...matchData,
          userRole: isOwner ? "finder" : isLostOwner ? "owner" : "viewer",
          canClaim: isLostOwner && matchData.status === "pending",
          canApprove: isOwner && matchData.status === "claimed",
        };
      });

      return {
        matches: processedMatches,
        total: matches.count,
      };
    } catch (error) {
      logger.error(`Error getting user matches: ${error.message}`);
      throw new Error("Failed to get user matches");
    }
  }

  /**
   * Get specific match details
   * @param {string} matchId - Match ID
   * @param {string} userId - User ID for authorization
   * @returns {Promise<Object|null>} Match details or null
   */
  static async getMatchDetail(matchId, userId) {
    try {
      const match = await Match.findByPk(matchId, {
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            include: [
              {
                model: User,
                as: "finder",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
          {
            model: LostItem,
            as: "lostItem",
            include: [
              {
                model: User,
                as: "owner",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
        ],
      });

      if (!match) {
        return null;
      }

      // Check if user has access to this match
      const hasAccess =
        match.foundItem?.userId === userId || match.lostItem?.userId === userId;

      if (!hasAccess) {
        logger.warn(
          `User ${userId} attempted to access unauthorized match ${matchId}`
        );
        return null;
      }

      const matchData = match.toJSON();

      // Add user role information
      const isOwner = matchData.foundItem?.userId === userId;
      const isLostOwner = matchData.lostItem?.userId === userId;

      return {
        ...matchData,
        userRole: isOwner ? "finder" : isLostOwner ? "owner" : "viewer",
        canClaim: isLostOwner && matchData.status === "pending",
        canApprove: isOwner && matchData.status === "claimed",
      };
    } catch (error) {
      logger.error(`Error getting match detail: ${error.message}`);
      throw new Error("Failed to get match detail");
    }
  }

  /**
   * Update match status
   * @param {string} matchId - Match ID
   * @param {string} status - New status
   * @param {string} userId - User ID for authorization
   * @returns {Promise<boolean>} Success status
   */
  static async updateMatchStatus(matchId, status, userId) {
    try {
      const match = await Match.findByPk(matchId, {
        include: ["foundItem", "lostItem"],
      });

      if (!match) {
        logger.warn(`Match not found: ${matchId}`);
        return false;
      }

      // Check authorization based on action
      let authorized = false;

      if (status === "claimed" && match.lostItem?.userId === userId) {
        authorized = true; // Lost item owner can claim
      } else if (status === "approved" && match.foundItem?.userId === userId) {
        authorized = true; // Found item owner can approve
      } else if (
        status === "rejected" &&
        (match.foundItem?.userId === userId ||
          match.lostItem?.userId === userId)
      ) {
        authorized = true; // Either party can reject
      }

      if (!authorized) {
        logger.warn(
          `User ${userId} not authorized to update match ${matchId} to status ${status}`
        );
        return false;
      }

      // Update match status
      await match.update({ status });

      // Handle status-specific actions
      if (status === "approved") {
        await this.handleMatchApproval(match);
      } else if (status === "claimed") {
        await this.handleMatchClaim(match);
      }

      logger.info(
        `Match ${matchId} status updated to ${status} by user ${userId}`
      );
      return true;
    } catch (error) {
      logger.error(`Error updating match status: ${error.message}`);
      throw new Error("Failed to update match status");
    }
  }

  /**
   * Process AI matches dari background service
   * @param {Array} aiMatches - AI match results
   * @returns {Promise<Array>} Created matches
   */
  static async processAIMatches(aiMatches) {
    try {
      logger.info(`Processing ${aiMatches.length} AI matches`);

      const createdMatches = [];

      for (const aiMatch of aiMatches) {
        try {
          const match = await this.createMatch(aiMatch);
          createdMatches.push(match);
        } catch (error) {
          logger.error(`Failed to process AI match: ${error.message}`);
          continue; // Continue dengan matches lainnya
        }
      }

      logger.info(
        `Successfully processed ${createdMatches.length} out of ${aiMatches.length} AI matches`
      );
      return createdMatches;
    } catch (error) {
      logger.error(`Error processing AI matches: ${error.message}`);
      throw new Error("Failed to process AI matches");
    }
  }

  /**
   * Update item statuses when match is created
   * @param {string} foundItemId - Found item ID
   * @param {string} lostItemId - Lost item ID
   */
  static async updateItemStatusesForMatch(foundItemId, lostItemId) {
    try {
      // Update found item status
      await FoundItem.update(
        { status: "pending_claim" },
        { where: { id: foundItemId, status: "available" } }
      );

      // Update lost item status
      await LostItem.update(
        { status: "has_matches" },
        { where: { id: lostItemId, status: "active" } }
      );

      logger.info(
        `Updated item statuses for match: ${foundItemId} <-> ${lostItemId}`
      );
    } catch (error) {
      logger.error(`Error updating item statuses: ${error.message}`);
      // Don't throw error to avoid disrupting match creation
    }
  }

  /**
   * Send notifications for new matches
   * @param {Object} match - Match object
   */
  static async sendMatchNotifications(match) {
    try {
      const matchWithItems = await Match.findByPk(match.id, {
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            include: [
              {
                model: User,
                as: "finder",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
          {
            model: LostItem,
            as: "lostItem",
            include: [
              {
                model: User,
                as: "owner",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
        ],
      });

      if (!matchWithItems) {
        logger.error(`Match not found for notifications: ${match.id}`);
        return;
      }

      // Send notification to lost item owner
      if (matchWithItems.lostItem?.owner) {
        await NotificationService.sendMatchFoundNotification(
          matchWithItems.lostItem.owner,
          {
            itemName: matchWithItems.foundItem.itemName,
            similarity: matchWithItems.similarity,
            location: matchWithItems.foundItem.locationFound,
            matchId: matchWithItems.id,
          }
        );
      }

      // Send notification to found item owner
      if (matchWithItems.foundItem?.finder) {
        await NotificationService.sendPotentialClaimNotification(
          matchWithItems.foundItem.finder,
          {
            itemName: matchWithItems.foundItem.itemName,
            similarity: matchWithItems.similarity,
            matchId: matchWithItems.id,
          }
        );
      }

      logger.info(`Sent match notifications for match ${match.id}`);
    } catch (error) {
      logger.error(`Error sending match notifications: ${error.message}`);
      // Don't throw error to avoid disrupting main flow
    }
  }

  /**
   * Handle match claim by lost item owner
   * @param {Object} match - Match object
   */
  static async handleMatchClaim(match) {
    try {
      // Send notification to found item owner
      const foundItemWithOwner = await FoundItem.findByPk(match.foundItemId, {
        include: [
          {
            model: User,
            as: "finder",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      const lostItemWithOwner = await LostItem.findByPk(match.lostItemId, {
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      if (foundItemWithOwner?.finder) {
        await NotificationService.sendClaimReceivedNotification(
          foundItemWithOwner.finder,
          {
            itemName: foundItemWithOwner.itemName,
            claimerName: `${lostItemWithOwner.owner.firstName} ${lostItemWithOwner.owner.lastName}`,
            matchId: match.id,
          }
        );
      }

      logger.info(`Handled claim for match ${match.id}`);
    } catch (error) {
      logger.error(`Error handling match claim: ${error.message}`);
    }
  }

  /**
   * Handle match approval by found item owner
   * @param {Object} match - Match object
   */
  static async handleMatchApproval(match) {
    try {
      // Update item statuses to resolved
      await FoundItem.update(
        { status: "claimed" },
        { where: { id: match.foundItemId } }
      );

      await LostItem.update(
        { status: "resolved" },
        { where: { id: match.lostItemId } }
      );

      // Send approval notification to lost item owner
      const lostItemWithOwner = await LostItem.findByPk(match.lostItemId, {
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      const foundItemWithOwner = await FoundItem.findByPk(match.foundItemId, {
        include: [
          {
            model: User,
            as: "finder",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      if (lostItemWithOwner?.owner && foundItemWithOwner?.finder) {
        await NotificationService.sendClaimApprovedNotification(
          lostItemWithOwner.owner,
          {
            itemName: lostItemWithOwner.itemName,
            finderName: `${foundItemWithOwner.finder.firstName} ${foundItemWithOwner.finder.lastName}`,
            finderPhone: foundItemWithOwner.finder.whatsappNumber,
            matchId: match.id,
          }
        );
      }

      logger.info(`Handled approval for match ${match.id}`);
    } catch (error) {
      logger.error(`Error handling match approval: ${error.message}`);
    }
  }

  /**
   * Expire old matches
   * @param {number} daysOld - Days old to consider for expiration
   * @returns {Promise<number>} Number of expired matches
   */
  static async expireOldMatches(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const [updatedCount] = await Match.update(
        { status: "expired" },
        {
          where: {
            status: "pending",
            createdAt: { [Op.lt]: cutoffDate },
          },
        }
      );

      logger.info(`Expired ${updatedCount} old matches`);
      return updatedCount;
    } catch (error) {
      logger.error(`Error expiring old matches: ${error.message}`);
      throw new Error("Failed to expire old matches");
    }
  }

  /**
   * Get match statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Match statistics
   */
  static async getMatchStatistics(userId) {
    try {
      // Get user's items
      const userFoundItems = await FoundItem.findAll({
        where: { userId },
        attributes: ["id"],
      });

      const userLostItems = await LostItem.findAll({
        where: { userId },
        attributes: ["id"],
      });

      const foundItemIds = userFoundItems.map((item) => item.id);
      const lostItemIds = userLostItems.map((item) => item.id);

      // Get match statistics
      const [foundMatches, lostMatches] = await Promise.all([
        Match.findAll({
          where: { foundItemId: { [Op.in]: foundItemIds } },
          attributes: [
            "status",
            [Match.sequelize.fn("COUNT", Match.sequelize.col("id")), "count"],
          ],
          group: ["status"],
        }),
        Match.findAll({
          where: { lostItemId: { [Op.in]: lostItemIds } },
          attributes: [
            "status",
            [Match.sequelize.fn("COUNT", Match.sequelize.col("id")), "count"],
          ],
          group: ["status"],
        }),
      ]);

      const processStats = (stats) => {
        const result = {};
        stats.forEach((stat) => {
          result[stat.status] = parseInt(stat.get("count"));
        });
        return result;
      };

      return {
        foundItemMatches: processStats(foundMatches),
        lostItemMatches: processStats(lostMatches),
        totalMatches: foundMatches.length + lostMatches.length,
      };
    } catch (error) {
      logger.error(`Error getting match statistics: ${error.message}`);
      throw new Error("Failed to get match statistics");
    }
  }

  /**
   * Handle AI notification dari AI Layer
   * @param {Object} notificationData - AI notification data
   * @returns {Promise<boolean>} Processing success
   */
  static async handleAINotification(notificationData) {
    try {
      const { item_id, collection, matches, timestamp } = notificationData;

      logger.info(
        `Processing AI notification for ${collection} item ${item_id} with ${matches.length} matches`
      );

      for (const match of matches) {
        try {
          const matchData = {
            foundItemId: collection === "found_items" ? item_id : match.item_id,
            lostItemId: collection === "lost_items" ? item_id : match.item_id,
            similarity: match.similarity,
            aiGenerated: true,
          };

          await this.createMatch(matchData);
        } catch (error) {
          logger.error(
            `Failed to create match from AI notification: ${error.message}`
          );
          continue;
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error handling AI notification: ${error.message}`);
      throw new Error("Failed to handle AI notification");
    }
  }

  /**
   * Get trending matches (high similarity matches)
   * @param {Object} filters - Filters (limit, threshold)
   * @returns {Promise<Array>} Trending matches
   */
  static async getTrendingMatches(filters = {}) {
    try {
      const { limit = 10, threshold = 0.8 } = filters;

      const matches = await Match.findAll({
        where: {
          similarity: { [Op.gte]: threshold },
          status: { [Op.in]: ["pending", "claimed"] },
        },
        limit,
        order: [
          ["similarity", "DESC"],
          ["createdAt", "DESC"],
        ],
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            attributes: [
              "id",
              "itemName",
              "category",
              "locationFound",
              "foundDate",
            ],
          },
          {
            model: LostItem,
            as: "lostItem",
            attributes: [
              "id",
              "itemName",
              "category",
              "lastSeenLocation",
              "dateLost",
              "reward",
            ],
          },
        ],
      });

      return matches.map((match) => ({
        ...match.toJSON(),
        confidenceLevel: this.getConfidenceLevel(match.similarity),
      }));
    } catch (error) {
      logger.error(`Error getting trending matches: ${error.message}`);
      throw new Error("Failed to get trending matches");
    }
  }

  /**
   * Get confidence level based on similarity
   * @param {number} similarity - Similarity score
   * @returns {string} Confidence level
   */
  static getConfidenceLevel(similarity) {
    if (similarity >= 0.9) return "Very High";
    if (similarity >= 0.8) return "High";
    if (similarity >= 0.7) return "Medium";
    if (similarity >= 0.6) return "Low";
    return "Very Low";
  }
}

module.exports = MatchService;
