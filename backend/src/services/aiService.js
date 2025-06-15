const axios = require("axios");
const logger = require("../utils/logger");

class AIService {
  constructor() {
    this.baseURL = process.env.AI_LAYER_URL || "http://localhost:8000";
    this.timeout = 30000; // 30 seconds
    this.retryAttempts = 3;
  }

  /**
   * Process found item for instant matching
   */
  async processFoundItem(itemData) {
    try {
      const response = await this.makeRequest(
        "/match/process-item",
        "POST",
        itemData
      );
      return response.data;
    } catch (error) {
      logger.error("AI Service - Process found item error:", error);
      throw error;
    }
  }

  /**
   * Process lost item (generate embeddings)
   */
  async processLostItem(itemData) {
    try {
      const response = await this.makeRequest(
        "/match/process-item",
        "POST",
        itemData
      );
      return response.data;
    } catch (error) {
      logger.error("AI Service - Process lost item error:", error);
      throw error;
    }
  }

  /**
   * Run background matching service
   */
  async runBackgroundMatching(options = {}) {
    try {
      const data = {
        limit: options.limit || 100,
        threshold: options.threshold || 0.75,
      };

      const response = await this.makeRequest(
        "/match/background",
        "POST",
        data
      );
      return response.data;
    } catch (error) {
      logger.error("AI Service - Background matching error:", error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two items
   */
  async calculateSimilarity(
    item1Id,
    item2Id,
    collection1 = "found_items",
    collection2 = "lost_items"
  ) {
    try {
      const data = {
        item1_id: item1Id,
        item2_id: item2Id,
        collection1,
        collection2,
      };

      const response = await this.makeRequest(
        "/match/similarity",
        "POST",
        data
      );
      return response.data;
    } catch (error) {
      logger.error("AI Service - Calculate similarity error:", error);
      throw error;
    }
  }

  /**
   * Get AI service health status
   */
  async getHealthStatus() {
    try {
      const response = await this.makeRequest("/health/status", "GET");
      return response.data;
    } catch (error) {
      logger.error("AI Service - Health check error:", error);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  /**
   * Get matching statistics
   */
  async getMatchingStats() {
    try {
      const response = await this.makeRequest("/match/stats", "GET");
      return response.data;
    } catch (error) {
      logger.error("AI Service - Get stats error:", error);
      throw error;
    }
  }

  /**
   * Make HTTP request to AI Layer with retry logic
   */
  async makeRequest(endpoint, method = "GET", data = null, retryCount = 0) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response;
    } catch (error) {
      // Retry logic for network errors
      if (retryCount < this.retryAttempts && this.isRetryableError(error)) {
        logger.warn(
          `AI Service request failed, retrying... (${retryCount + 1}/${
            this.retryAttempts
          })`
        );
        await this.sleep(1000 * (retryCount + 1)); // Exponential backoff
        return this.makeRequest(endpoint, method, data, retryCount + 1);
      }

      // Log error details
      if (error.response) {
        logger.error(
          `AI Service HTTP error: ${error.response.status} - ${error.response.statusText}`
        );
        logger.error("Response data:", error.response.data);
      } else if (error.request) {
        logger.error("AI Service network error:", error.message);
      } else {
        logger.error("AI Service request error:", error.message);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    // Retry on network errors or 5xx server errors
    return (
      !error.response ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT" ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if AI service is available
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/ping`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = { AIService: new AIService() };
