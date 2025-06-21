const axios = require("axios");
const config = require("../config/app");

class AIService {
  constructor() {
    this.apiUrl = config.AI_LAYER_URL;
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
    });
  }

  async processFoundItem(itemData) {
    try {
      console.log("Sending found item to AI Layer:", {
        item_id: itemData.id,
        item_name: itemData.itemName,
        description: itemData.description,
        image_urls: itemData.images || [],
        collection: "found_items",
      });

      const response = await this.client.post("/match/instant", {
        item_id: itemData.id,
        item_name: itemData.itemName,
        description: itemData.description,
        image_urls: itemData.images || [],
        collection: "found_items",
      });

      console.log("AI Layer response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error processing found item with AI:", error.message);
      if (error.response) {
        console.error("AI service response:", error.response.data);
      }
      throw new Error("Failed to process item with AI service");
    }
  }

  async processLostItem(itemData) {
    try {
      console.log("Sending lost item to AI Layer:", {
        item_id: itemData.id,
        item_name: itemData.itemName,
        description: itemData.description,
        image_urls: itemData.images || [],
        collection: "lost_items",
      });

      const response = await this.client.post("/match/instant", {
        item_id: itemData.id,
        item_name: itemData.itemName,
        description: itemData.description,
        image_urls: itemData.images || [],
        collection: "lost_items",
      });

      console.log("AI Layer response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error processing lost item with AI:", error.message);
      if (error.response) {
        console.error("AI service response:", error.response.data);
      }
      throw new Error("Failed to process item with AI service");
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get("/health");
      return response.data;
    } catch (error) {
      console.error("AI Layer health check failed:", error.message);
      throw error;
    }
  }
}

module.exports = new AIService();
