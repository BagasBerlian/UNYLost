// File: backend/src/services/AIService.js - Integrasi dengan AI Layer
const axios = require("axios");
const logger = require("../utils/logger");
const MatchService = require("./MatchService");

class AIService {
  constructor() {
    this.aiLayerUrl = process.env.AI_LAYER_URL || "http://localhost:8000";
    this.timeout = 30000; // 30 seconds timeout
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Create axios instance with default config
   */
  createAxiosInstance() {
    return axios.create({
      baseURL: this.aiLayerUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /**
   * Check if AI Layer is available
   * @returns {Promise<boolean>} AI Layer availability
   */
  async checkAILayerHealth() {
    try {
      const client = this.createAxiosInstance();
      const response = await client.get("/health/status");

      return (
        response.data.models?.clip_ready && response.data.models?.sentence_ready
      );
    } catch (error) {
      logger.warn(`AI Layer health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Process found item for matching
   * @param {Object} foundItem - Found item data
   * @returns {Promise<Object>} Processing result
   */
  async processFoundItem(foundItem) {
    try {
      logger.info(`Processing found item ${foundItem.id} with AI Layer`);

      // Check AI Layer availability
      const isAIAvailable = await this.checkAILayerHealth();
      if (!isAIAvailable) {
        logger.warn("AI Layer not available, skipping AI processing");
        return { success: false, message: "AI Layer not available" };
      }

      // Prepare request data
      const requestData = {
        item_id: foundItem.id,
        item_name: foundItem.itemName,
        description: foundItem.description,
        category: foundItem.category,
        image_url: foundItem.images?.[0] || null, // Use first image
        collection: "found_items",
        threshold: 0.75,
        max_results: 10,
      };

      const client = this.createAxiosInstance();
      const response = await this.makeRetryRequest(() =>
        client.post("/match/process-item", requestData)
      );

      logger.info(`AI processing completed for found item ${foundItem.id}`);

      // Process matches if any
      if (response.data.matches && response.data.matches.length > 0) {
        await this.processMatches(foundItem, response.data.matches, "found");

        return {
          success: true,
          matchesCount: response.data.matches.length,
          matches: response.data.matches,
        };
      }

      return {
        success: true,
        matchesCount: 0,
        message: "No matches found",
      };
    } catch (error) {
      logger.error(`Error processing found item with AI: ${error.message}`);
      throw new Error("AI processing failed");
    }
  }

  /**
   * Process lost item for matching
   * @param {Object} lostItem - Lost item data
   * @returns {Promise<Object>} Processing result
   */
  async processLostItem(lostItem) {
    try {
      logger.info(`Processing lost item ${lostItem.id} with AI Layer`);

      // Check AI Layer availability
      const isAIAvailable = await this.checkAILayerHealth();
      if (!isAIAvailable) {
        logger.warn("AI Layer not available, skipping AI processing");
        return { success: false, message: "AI Layer not available" };
      }

      // Prepare request data
      const requestData = {
        item_id: lostItem.id,
        item_name: lostItem.itemName,
        description: lostItem.description,
        category: lostItem.category,
        image_url: lostItem.images?.[0] || null, // Use first image if available
        collection: "lost_items",
        threshold: 0.75,
        max_results: 10,
      };

      const client = this.createAxiosInstance();
      const response = await this.makeRetryRequest(() =>
        client.post("/match/process-item", requestData)
      );

      logger.info(`AI processing completed for lost item ${lostItem.id}`);

      // Process matches if any
      if (response.data.matches && response.data.matches.length > 0) {
        await this.processMatches(lostItem, response.data.matches, "lost");

        return {
          success: true,
          matchesCount: response.data.matches.length,
          matches: response.data.matches,
        };
      }

      return {
        success: true,
        matchesCount: 0,
        message: "No matches found",
      };
    } catch (error) {
      logger.error(`Error processing lost item with AI: ${error.message}`);
      throw new Error("AI processing failed");
    }
  }

  /**
   * Process background matching for all active items
   * @param {number} limit - Maximum items to process
   * @returns {Promise<Object>} Processing result
   */
  async processBackgroundMatching(limit = 100) {
    try {
      logger.info(`Starting background AI matching for up to ${limit} items`);

      // Check AI Layer availability
      const isAIAvailable = await this.checkAILayerHealth();
      if (!isAIAvailable) {
        logger.warn("AI Layer not available, skipping background matching");
        return { success: false, message: "AI Layer not available" };
      }

      const requestData = {
        limit,
        threshold: 0.75,
      };

      const client = this.createAxiosInstance();
      const response = await this.makeRetryRequest(() =>
        client.post("/match/background", requestData)
      );

      logger.info(
        `Background AI matching completed. Processed: ${response.data.processed_items}`
      );

      return {
        success: true,
        processedItems: response.data.processed_items,
        newMatches: response.data.new_matches || 0,
        message: "Background matching completed",
      };
    } catch (error) {
      logger.error(`Error in background AI matching: ${error.message}`);
      throw new Error("Background AI matching failed");
    }
  }

  /**
   * Calculate similarity between two items
   * @param {string} item1Id - First item ID
   * @param {string} item2Id - Second item ID
   * @param {string} collection1 - First item collection
   * @param {string} collection2 - Second item collection
   * @returns {Promise<number>} Similarity score
   */
  async calculateSimilarity(
    item1Id,
    item2Id,
    collection1 = "found_items",
    collection2 = "lost_items"
  ) {
    try {
      const requestData = {
        item1_id: item1Id,
        item2_id: item2Id,
        collection1,
        collection2,
      };

      const client = this.createAxiosInstance();
      const response = await this.makeRetryRequest(() =>
        client.post("/match/similarity", requestData)
      );

      return response.data.similarity || 0;
    } catch (error) {
      logger.error(`Error calculating similarity: ${error.message}`);
      return 0;
    }
  }

  /**
   * Process matches and create match records
   * @param {Object} item - Source item
   * @param {Array} matches - AI matches
   * @param {string} itemType - Item type (found/lost)
   */
  async processMatches(item, matches, itemType) {
    try {
      for (const match of matches) {
        // Create match record in database
        const matchData = {
          foundItemId: itemType === "found" ? item.id : match.item_id,
          lostItemId: itemType === "lost" ? item.id : match.item_id,
          similarity: match.similarity,
          aiGenerated: true,
          status: "pending",
        };

        await MatchService.createMatch(matchData);

        // Send notification if similarity is high enough
        if (match.similarity >= 0.8) {
          await this.sendHighSimilarityNotification(
            matchData,
            match.similarity
          );
        }
      }
    } catch (error) {
      logger.error(`Error processing AI matches: ${error.message}`);
      // Don't throw error to avoid disrupting the main flow
    }
  }

  /**
   * Send notification for high similarity matches
   * @param {Object} matchData - Match data
   * @param {number} similarity - Similarity score
   */
  async sendHighSimilarityNotification(matchData, similarity) {
    try {
      // This would integrate with notification service
      logger.info(
        `High similarity match found (${similarity}): ${matchData.foundItemId} <-> ${matchData.lostItemId}`
      );

      // TODO: Implement notification sending
      // await NotificationService.sendMatchFoundNotification(matchData, similarity);
    } catch (error) {
      logger.error(
        `Error sending high similarity notification: ${error.message}`
      );
    }
  }

  /**
   * Make request with retry logic
   * @param {Function} requestFn - Request function
   * @returns {Promise<Object>} Response data
   */
  async makeRetryRequest(requestFn) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await requestFn();
        return response;
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts) {
          logger.warn(
            `AI request attempt ${attempt} failed, retrying in ${this.retryDelay}ms: ${error.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
          this.retryDelay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Get AI Layer status and statistics
   * @returns {Promise<Object>} AI Layer status
   */
  async getAILayerStatus() {
    try {
      const client = this.createAxiosInstance();
      const response = await client.get("/health/status");

      return {
        available: true,
        status: response.data,
        models: response.data.models,
        device: response.data.device,
      };
    } catch (error) {
      logger.error(`Error getting AI Layer status: ${error.message}`);
      return {
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Trigger AI processing for specific item (manual trigger)
   * @param {string} itemId - Item ID
   * @param {string} itemType - Item type (found/lost)
   * @returns {Promise<Object>} Processing result
   */
  async triggerManualProcessing(itemId, itemType) {
    try {
      logger.info(
        `Manually triggering AI processing for ${itemType} item ${itemId}`
      );

      // Get item data from database
      const ItemService = require("./ItemService");
      const item = await ItemService.getItemById(itemId, itemType);

      if (!item) {
        throw new Error("Item not found");
      }

      // Process based on item type
      if (itemType === "found") {
        return await this.processFoundItem(item);
      } else if (itemType === "lost") {
        return await this.processLostItem(item);
      } else {
        throw new Error("Invalid item type");
      }
    } catch (error) {
      logger.error(`Error in manual AI processing: ${error.message}`);
      throw error;
    }
  }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService;
