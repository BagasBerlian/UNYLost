// File: backend/src/services/ItemService.js - Business Logic untuk Items
const { FoundItem, LostItem, User } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

class ItemService {
  /**
   * Create new found item
   * @param {Object} itemData - Found item data
   * @returns {Promise<Object>} Created found item
   */
  static async createFoundItem(itemData) {
    try {
      logger.info(`Creating found item: ${itemData.itemName}`);

      const foundItem = await FoundItem.create({
        ...itemData,
        aiProcessed: false,
        status: "available",
      });

      // Include user data in response
      const itemWithUser = await FoundItem.findByPk(foundItem.id, {
        include: [
          {
            model: User,
            as: "finder",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      logger.info(`Found item created successfully: ${foundItem.id}`);
      return itemWithUser;
    } catch (error) {
      logger.error(`Error creating found item: ${error.message}`);
      throw new Error("Failed to create found item");
    }
  }

  /**
   * Create new lost item
   * @param {Object} itemData - Lost item data
   * @returns {Promise<Object>} Created lost item
   */
  static async createLostItem(itemData) {
    try {
      logger.info(`Creating lost item: ${itemData.itemName}`);

      const lostItem = await LostItem.create({
        ...itemData,
        aiProcessed: false,
        status: "active",
      });

      // Include user data in response
      const itemWithUser = await LostItem.findByPk(lostItem.id, {
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      });

      logger.info(`Lost item created successfully: ${lostItem.id}`);
      return itemWithUser;
    } catch (error) {
      logger.error(`Error creating lost item: ${error.message}`);
      throw new Error("Failed to create lost item");
    }
  }

  /**
   * Get user's items (found and lost)
   * @param {string} userId - User ID
   * @param {Object} filters - Filters (type, status, page, limit)
   * @returns {Promise<Object>} Items with pagination
   */
  static async getUserItems(userId, filters = {}) {
    try {
      const { type = "all", status, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      let items = [];
      let total = 0;

      // Build where clause for status filter
      const whereClause = { userId };
      if (status) {
        whereClause.status = status;
      }

      if (type === "found" || type === "all") {
        const foundItems = await FoundItem.findAndCountAll({
          where: whereClause,
          limit: type === "found" ? limit : undefined,
          offset: type === "found" ? offset : undefined,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "finder",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        });

        const processedFoundItems = foundItems.rows.map((item) => ({
          ...item.toJSON(),
          type: "found",
        }));

        if (type === "found") {
          return {
            items: processedFoundItems,
            total: foundItems.count,
          };
        }

        items = items.concat(processedFoundItems);
        total += foundItems.count;
      }

      if (type === "lost" || type === "all") {
        const lostItems = await LostItem.findAndCountAll({
          where: whereClause,
          limit: type === "lost" ? limit : undefined,
          offset: type === "lost" ? offset : undefined,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "owner",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        });

        const processedLostItems = lostItems.rows.map((item) => ({
          ...item.toJSON(),
          type: "lost",
        }));

        if (type === "lost") {
          return {
            items: processedLostItems,
            total: lostItems.count,
          };
        }

        items = items.concat(processedLostItems);
        total += lostItems.count;
      }

      // If type is 'all', we need to sort and paginate manually
      if (type === "all") {
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const paginatedItems = items.slice(offset, offset + limit);

        return {
          items: paginatedItems,
          total,
        };
      }

      return { items, total };
    } catch (error) {
      logger.error(`Error getting user items: ${error.message}`);
      throw new Error("Failed to get user items");
    }
  }

  /**
   * Get item by ID
   * @param {string} itemId - Item ID
   * @param {string} type - Item type (found/lost)
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Item data or null
   */
  static async getItemById(itemId, type, userId) {
    try {
      let item;

      if (type === "found") {
        item = await FoundItem.findOne({
          where: { id: itemId, userId },
          include: [
            {
              model: User,
              as: "finder",
              attributes: ["id", "firstName", "lastName", "whatsappNumber"],
            },
          ],
        });
      } else if (type === "lost") {
        item = await LostItem.findOne({
          where: { id: itemId, userId },
          include: [
            {
              model: User,
              as: "owner",
              attributes: ["id", "firstName", "lastName", "whatsappNumber"],
            },
          ],
        });
      }

      if (item) {
        return {
          ...item.toJSON(),
          type,
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error getting item by ID: ${error.message}`);
      throw new Error("Failed to get item");
    }
  }

  /**
   * Update item status
   * @param {string} itemId - Item ID
   * @param {string} type - Item type (found/lost)
   * @param {string} status - New status
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  static async updateItemStatus(itemId, type, status, userId) {
    try {
      let result;

      if (type === "found") {
        result = await FoundItem.update(
          { status },
          {
            where: { id: itemId, userId },
            returning: true,
          }
        );
      } else if (type === "lost") {
        result = await LostItem.update(
          { status },
          {
            where: { id: itemId, userId },
            returning: true,
          }
        );
      }

      return result && result[0] > 0;
    } catch (error) {
      logger.error(`Error updating item status: ${error.message}`);
      throw new Error("Failed to update item status");
    }
  }

  /**
   * Delete item (soft delete by updating status)
   * @param {string} itemId - Item ID
   * @param {string} type - Item type (found/lost)
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  static async deleteItem(itemId, type, userId) {
    try {
      let result;

      if (type === "found") {
        result = await FoundItem.update(
          { status: "expired" },
          {
            where: { id: itemId, userId },
            returning: true,
          }
        );
      } else if (type === "lost") {
        result = await LostItem.update(
          { status: "expired" },
          {
            where: { id: itemId, userId },
            returning: true,
          }
        );
      }

      return result && result[0] > 0;
    } catch (error) {
      logger.error(`Error deleting item: ${error.message}`);
      throw new Error("Failed to delete item");
    }
  }

  /**
   * Get active found items for matching
   * @param {Object} filters - Filters (category, location, etc.)
   * @returns {Promise<Array>} Active found items
   */
  static async getActiveFoundItems(filters = {}) {
    try {
      const whereClause = {
        status: "available",
      };

      if (filters.category) {
        whereClause.category = filters.category;
      }

      if (filters.excludeUserId) {
        whereClause.userId = { [Op.ne]: filters.excludeUserId };
      }

      const foundItems = await FoundItem.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "finder",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      return foundItems;
    } catch (error) {
      logger.error(`Error getting active found items: ${error.message}`);
      throw new Error("Failed to get active found items");
    }
  }

  /**
   * Get active lost items for matching
   * @param {Object} filters - Filters (category, location, etc.)
   * @returns {Promise<Array>} Active lost items
   */
  static async getActiveLostItems(filters = {}) {
    try {
      const whereClause = {
        status: { [Op.in]: ["active", "has_matches"] },
      };

      if (filters.category) {
        whereClause.category = filters.category;
      }

      if (filters.excludeUserId) {
        whereClause.userId = { [Op.ne]: filters.excludeUserId };
      }

      const lostItems = await LostItem.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      return lostItems;
    } catch (error) {
      logger.error(`Error getting active lost items: ${error.message}`);
      throw new Error("Failed to get active lost items");
    }
  }

  /**
   * Mark item as AI processed
   * @param {string} itemId - Item ID
   * @param {string} type - Item type (found/lost)
   * @returns {Promise<boolean>} Success status
   */
  static async markAsAIProcessed(itemId, type) {
    try {
      let result;

      if (type === "found") {
        result = await FoundItem.update(
          {
            aiProcessed: true,
            lastMatchedAt: new Date(),
          },
          { where: { id: itemId } }
        );
      } else if (type === "lost") {
        result = await LostItem.update(
          {
            aiProcessed: true,
            lastMatchedAt: new Date(),
          },
          { where: { id: itemId } }
        );
      }

      return result && result[0] > 0;
    } catch (error) {
      logger.error(`Error marking item as AI processed: ${error.message}`);
      throw new Error("Failed to update AI processing status");
    }
  }

  /**
   * Get items that need AI processing
   * @param {string} type - Item type (found/lost)
   * @param {number} limit - Limit number of items
   * @returns {Promise<Array>} Items needing AI processing
   */
  static async getItemsForAIProcessing(type, limit = 50) {
    try {
      const whereClause = {
        aiProcessed: false,
        status: type === "found" ? "available" : "active",
      };

      let items;

      if (type === "found") {
        items = await FoundItem.findAll({
          where: whereClause,
          limit,
          order: [["createdAt", "ASC"]],
          include: [
            {
              model: User,
              as: "finder",
              attributes: ["id", "firstName", "lastName", "whatsappNumber"],
            },
          ],
        });
      } else if (type === "lost") {
        items = await LostItem.findAll({
          where: whereClause,
          limit,
          order: [["createdAt", "ASC"]],
          include: [
            {
              model: User,
              as: "owner",
              attributes: ["id", "firstName", "lastName", "whatsappNumber"],
            },
          ],
        });
      }

      return items || [];
    } catch (error) {
      logger.error(`Error getting items for AI processing: ${error.message}`);
      throw new Error("Failed to get items for AI processing");
    }
  }

  /**
   * Get items statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Items statistics
   */
  static async getUserItemsStats(userId) {
    try {
      const [foundStats, lostStats] = await Promise.all([
        FoundItem.findAll({
          where: { userId },
          attributes: [
            "status",
            [
              FoundItem.sequelize.fn("COUNT", FoundItem.sequelize.col("id")),
              "count",
            ],
          ],
          group: ["status"],
        }),
        LostItem.findAll({
          where: { userId },
          attributes: [
            "status",
            [
              LostItem.sequelize.fn("COUNT", LostItem.sequelize.col("id")),
              "count",
            ],
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
        found: processStats(foundStats),
        lost: processStats(lostStats),
      };
    } catch (error) {
      logger.error(`Error getting user items stats: ${error.message}`);
      throw new Error("Failed to get items statistics");
    }
  }
}

module.exports = ItemService;
