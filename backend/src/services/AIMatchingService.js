// File: backend/src/services/AIMatchingService.js
// AI Layer integration untuk matching items di My Items functionality

const axios = require("axios");
const logger = require("../utils/logger");
const { Match, FoundItem, LostItem, User } = require("../models");

class AIMatchingService {
  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    this.matchingThreshold = parseFloat(process.env.MATCHING_THRESHOLD) || 0.75;
    this.maxMatches = parseInt(process.env.MAX_MATCHES_PER_ITEM) || 10;
  }

  /**
   * Trigger AI matching untuk item baru (sesuai sequence diagram)
   * Called setelah user upload item di My Items
   */
  async triggerInstantMatching(itemId, itemType, itemData) {
    try {
      logger.info(`🤖 Triggering AI matching for ${itemType} item: ${itemId}`);

      // Prepare data untuk AI service
      const matchingData = {
        item_id: itemId,
        item_name: itemData.itemName,
        description: itemData.description,
        category: itemData.category,
        image_urls: itemData.images || [],
        collection: `${itemType}_items`,
        threshold: this.matchingThreshold,
        max_results: this.maxMatches,
      };

      // Call AI service untuk instant matching
      const response = await axios.post(
        `${this.aiServiceUrl}/ai/match/instant`,
        matchingData,
        {
          timeout: 30000, // 30 seconds timeout
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.AI_API_KEY || "uny_lost_ai_key",
          },
        }
      );

      if (response.data.success && response.data.matches) {
        // Process AI matches dan save ke database
        const savedMatches = await this.processAIMatches(
          itemId,
          itemType,
          response.data.matches
        );

        logger.info(
          `✅ AI matching completed: ${savedMatches.length} matches found for ${itemId}`
        );
        return {
          success: true,
          matchesCount: savedMatches.length,
          matches: savedMatches,
        };
      }

      return {
        success: true,
        matchesCount: 0,
        matches: [],
      };
    } catch (error) {
      logger.error(`❌ AI matching failed for ${itemId}:`, error.message);

      // Don't throw error - matching failure shouldn't prevent item creation
      return {
        success: false,
        error: error.message,
        matchesCount: 0,
        matches: [],
      };
    }
  }

  /**
   * Background matching service (sesuai sequence diagram)
   * Runs setiap 2 jam untuk find new matches
   */
  async runBackgroundMatching() {
    try {
      logger.info("🤖 Starting background AI matching...");

      const response = await axios.post(
        `${this.aiServiceUrl}/ai/match/background`,
        {
          threshold: this.matchingThreshold,
          limit: 100,
          batch_size: 20,
        },
        {
          timeout: 300000, // 5 minutes timeout for background job
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.AI_API_KEY || "uny_lost_ai_key",
          },
        }
      );

      if (response.data.success && response.data.new_matches) {
        const processedMatches = await this.processBatchMatches(
          response.data.new_matches
        );

        logger.info(
          `✅ Background matching completed: ${processedMatches.length} new matches`
        );
        return {
          success: true,
          newMatches: processedMatches.length,
          processed: processedMatches,
        };
      }

      return {
        success: true,
        newMatches: 0,
        processed: [],
      };
    } catch (error) {
      logger.error("❌ Background matching failed:", error.message);
      throw error;
    }
  }

  /**
   * Process AI matches dan save ke database
   */
  async processAIMatches(itemId, itemType, aiMatches) {
    const savedMatches = [];

    try {
      for (const match of aiMatches) {
        // Check if match already exists
        const existingMatch = await Match.findOne({
          where: {
            ...(itemType === "found"
              ? {
                  foundItemId: itemId,
                  lostItemId: match.lost_item_id || match.found_item_id,
                }
              : {
                  lostItemId: itemId,
                  foundItemId: match.found_item_id || match.lost_item_id,
                }),
          },
        });

        if (!existingMatch) {
          // Create new match
          const newMatch = await Match.create({
            foundItemId:
              itemType === "found"
                ? itemId
                : match.found_item_id || match.item_id,
            lostItemId:
              itemType === "lost"
                ? itemId
                : match.lost_item_id || match.item_id,
            similarity: match.similarity,
            matchType: match.type || "hybrid",
            status: "pending",
            aiMetadata: {
              imageScore: match.image_score,
              textScore: match.text_score,
              hybridScore: match.similarity,
              aiModel: match.model_version || "clip_sentence_transformer",
              confidence: match.confidence,
            },
          });

          savedMatches.push(newMatch);

          // Trigger notifications untuk match owners
          await this.notifyMatchFound(newMatch);
        }
      }

      return savedMatches;
    } catch (error) {
      logger.error("Error processing AI matches:", error.message);
      throw error;
    }
  }

  /**
   * Process batch matches dari background job
   */
  async processBatchMatches(batchMatches) {
    const processedMatches = [];

    try {
      for (const matchData of batchMatches) {
        const { lost_id, found_id, similarity, type } = matchData;

        // Check if match already exists
        const existingMatch = await Match.findOne({
          where: {
            foundItemId: found_id,
            lostItemId: lost_id,
          },
        });

        if (!existingMatch) {
          const newMatch = await Match.create({
            foundItemId: found_id,
            lostItemId: lost_id,
            similarity: similarity,
            matchType: type || "hybrid",
            status: "pending",
            aiMetadata: {
              source: "background_job",
              batchId: matchData.batch_id,
              processedAt: new Date(),
            },
          });

          processedMatches.push(newMatch);

          // Notify both item owners
          await this.notifyMatchFound(newMatch);
        }
      }

      return processedMatches;
    } catch (error) {
      logger.error("Error processing batch matches:", error.message);
      throw error;
    }
  }

  /**
   * Notify users tentang new matches (sesuai sequence diagram)
   */
  async notifyMatchFound(match) {
    try {
      // Get item details with owner information
      const [foundItem, lostItem] = await Promise.all([
        FoundItem.findByPk(match.foundItemId, {
          include: [
            {
              model: User,
              as: "finder",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "whatsappNumber",
              ],
            },
          ],
        }),
        LostItem.findByPk(match.lostItemId, {
          include: [
            {
              model: User,
              as: "owner",
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "whatsappNumber",
              ],
            },
          ],
        }),
      ]);

      if (!foundItem || !lostItem) {
        logger.error("Cannot notify - item or owner not found");
        return false;
      }

      // Import notification services
      const NotificationService = require("./NotificationService");
      const WhatsAppService = require("./WhatsappService");

      // Notify lost item owner (someone found their item!)
      await NotificationService.sendMatchFoundNotification(lostItem.owner.id, {
        matchId: match.id,
        itemType: "lost",
        ownItemName: lostItem.itemName,
        matchedItemName: foundItem.itemName,
        similarity: match.similarity,
        finderName: `${foundItem.finder.firstName} ${foundItem.finder.lastName}`,
        finderContact: foundItem.finder.whatsappNumber,
      });

      // Send WhatsApp notification to lost item owner
      if (lostItem.owner.whatsappNumber) {
        await WhatsAppService.sendMatchFoundMessage(
          lostItem.owner.whatsappNumber,
          {
            ownerName: lostItem.owner.firstName,
            lostItemName: lostItem.itemName,
            foundItemName: foundItem.itemName,
            similarity: Math.round(match.similarity * 100),
            finderName: foundItem.finder.firstName,
          }
        );
      }

      // Notify found item owner (potential match for their found item)
      await NotificationService.sendMatchFoundNotification(
        foundItem.finder.id,
        {
          matchId: match.id,
          itemType: "found",
          ownItemName: foundItem.itemName,
          matchedItemName: lostItem.itemName,
          similarity: match.similarity,
          ownerName: `${lostItem.owner.firstName} ${lostItem.owner.lastName}`,
          ownerContact: lostItem.owner.whatsappNumber,
        }
      );

      // Send WhatsApp notification to found item owner
      if (foundItem.finder.whatsappNumber) {
        await WhatsAppService.sendMatchFoundMessage(
          foundItem.finder.whatsappNumber,
          {
            ownerName: foundItem.finder.firstName,
            foundItemName: foundItem.itemName,
            lostItemName: lostItem.itemName,
            similarity: Math.round(match.similarity * 100),
            lostOwnerName: lostItem.owner.firstName,
          }
        );
      }

      logger.info(`✅ Match notifications sent for match ${match.id}`);
      return true;
    } catch (error) {
      logger.error("Error sending match notifications:", error.message);
      return false;
    }
  }

  /**
   * Update item di AI service ketika status berubah
   */
  async updateItemStatus(itemId, itemType, newStatus) {
    try {
      const response = await axios.put(
        `${this.aiServiceUrl}/ai/items/${itemId}/status`,
        {
          item_type: itemType,
          status: newStatus,
          collection: `${itemType}_items`,
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.AI_API_KEY || "uny_lost_ai_key",
          },
        }
      );

      logger.info(
        `✅ AI service updated ${itemType} item ${itemId} status to ${newStatus}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `❌ Failed to update AI service for ${itemId}:`,
        error.message
      );
      // Don't throw - AI update failure shouldn't block status update
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove item dari AI service ketika dihapus
   */
  async removeItem(itemId, itemType) {
    try {
      const response = await axios.delete(
        `${this.aiServiceUrl}/ai/items/${itemId}`,
        {
          timeout: 10000,
          headers: {
            "X-API-Key": process.env.AI_API_KEY || "uny_lost_ai_key",
          },
          data: {
            item_type: itemType,
            collection: `${itemType}_items`,
          },
        }
      );

      logger.info(`✅ AI service removed ${itemType} item ${itemId}`);
      return response.data;
    } catch (error) {
      logger.error(
        `❌ Failed to remove item from AI service ${itemId}:`,
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get AI service health status
   */
  async getAIServiceHealth() {
    try {
      const response = await axios.get(`${this.aiServiceUrl}/health`, {
        timeout: 5000,
      });

      return {
        status: "healthy",
        aiService: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = new AIMatchingService();
