// File: backend/src/services/ItemService.js - Business Logic untuk Items
const { FoundItem, LostItem, User } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

class ItemService {
  /**
   * Get user's items by email (found and lost items)
   * @param {string} userEmail - Email user yang sedang login
   * @param {Object} filters - Filters (type, status, page, limit)
   * @returns {Promise<Object>} Items with pagination
   */
  static async getUserItemsByEmail(userEmail, filters = {}) {
    try {
      const { type = "all", status, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      logger.info(`Getting items for user email: ${userEmail}, type: ${type}`);

      // First, find user by email
      const user = await User.findOne({
        where: { email: userEmail, isActive: true },
        attributes: ["id", "firstName", "lastName", "email"],
      });

      if (!user) {
        throw new Error("User not found");
      }

      const userId = user.id;
      let items = [];
      let total = 0;

      // Build where clause for status filter
      const whereClause = { userId };
      if (status) {
        whereClause.status = status;
      }

      // Include options for related data
      const includeOptions = [
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
      ];

      if (type === "found" || type === "all") {
        const foundQuery = {
          where: whereClause,
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
          order: [["createdAt", "DESC"]],
          attributes: {
            include: [
              // Add match count
              [
                '(SELECT COUNT(*) FROM matches WHERE foundItemId = FoundItem.id AND status = "pending")',
                "matchCount",
              ],
              // Add claim count
              [
                "(SELECT COUNT(*) FROM claims WHERE foundItemId = FoundItem.id)",
                "claimCount",
              ],
            ],
          },
        };

        if (type === "found") {
          foundQuery.limit = limit;
          foundQuery.offset = offset;
        }

        const foundItems = await FoundItem.findAndCountAll(foundQuery);

        if (type === "found") {
          return {
            items: foundItems.rows.map((item) => ({
              ...item.toJSON(),
              type: "found",
              itemType: "found",
            })),
            total: foundItems.count,
            user: user,
          };
        }

        items = items.concat(
          foundItems.rows.map((item) => ({
            ...item.toJSON(),
            type: "found",
            itemType: "found",
          }))
        );
        total += foundItems.count;
      }

      if (type === "lost" || type === "all") {
        const lostQuery = {
          where: whereClause,
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
          order: [["createdAt", "DESC"]],
          attributes: {
            include: [
              // Add match count
              [
                '(SELECT COUNT(*) FROM matches WHERE lostItemId = LostItem.id AND status = "pending")',
                "matchCount",
              ],
              // Add claim count
              [
                "(SELECT COUNT(*) FROM claims WHERE lostItemId = LostItem.id)",
                "claimCount",
              ],
            ],
          },
        };

        if (type === "lost") {
          lostQuery.limit = limit;
          lostQuery.offset = offset;
        }

        const lostItems = await LostItem.findAndCountAll(lostQuery);

        if (type === "lost") {
          return {
            items: lostItems.rows.map((item) => ({
              ...item.toJSON(),
              type: "lost",
              itemType: "lost",
            })),
            total: lostItems.count,
            user: user,
          };
        }

        items = items.concat(
          lostItems.rows.map((item) => ({
            ...item.toJSON(),
            type: "lost",
            itemType: "lost",
          }))
        );
        total += lostItems.count;
      }

      // Sort all items by creation date if getting both types
      if (type === "all") {
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply pagination to combined results
        const paginatedItems = items.slice(offset, offset + limit);

        return {
          items: paginatedItems,
          total,
          user: user,
        };
      }

      logger.info(`Retrieved ${items.length} items for user ${userEmail}`);

      return {
        items,
        total,
        user: user,
      };
    } catch (error) {
      logger.error(`Error getting user items: ${error.message}`);
      throw new Error(`Failed to get user items: ${error.message}`);
    }
  }

  /**
   * Get detailed item statistics for user
   * @param {string} userEmail - Email user
   * @returns {Promise<Object>} Item statistics
   */
  static async getUserItemStats(userEmail) {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: userEmail, isActive: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const userId = user.id;

      // Get counts for different item types and statuses
      const [
        foundItemsCount,
        lostItemsCount,
        activeFoundItems,
        activeLostItems,
        claimedFoundItems,
        resolvedLostItems,
        totalMatches,
        totalClaims,
      ] = await Promise.all([
        FoundItem.count({ where: { userId } }),
        LostItem.count({ where: { userId } }),
        FoundItem.count({ where: { userId, status: "available" } }),
        LostItem.count({ where: { userId, status: "active" } }),
        FoundItem.count({ where: { userId, status: "claimed" } }),
        LostItem.count({ where: { userId, status: "resolved" } }),
        Match.count({
          include: [
            {
              model: FoundItem,
              where: { userId },
              required: true,
            },
          ],
        }),
        Claim.count({
          include: [
            {
              model: FoundItem,
              where: { userId },
              required: true,
            },
          ],
        }),
      ]);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        },
        statistics: {
          totalItems: foundItemsCount + lostItemsCount,
          foundItems: {
            total: foundItemsCount,
            active: activeFoundItems,
            claimed: claimedFoundItems,
          },
          lostItems: {
            total: lostItemsCount,
            active: activeLostItems,
            resolved: resolvedLostItems,
          },
          matches: totalMatches,
          claims: totalClaims,
        },
      };
    } catch (error) {
      logger.error(`Error getting user stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get item detail with ownership verification
   * @param {string} itemId - Item ID
   * @param {string} itemType - Type (found/lost)
   * @param {string} userEmail - User email for ownership verification
   * @returns {Promise<Object>} Item detail
   */
  static async getItemDetailByOwner(itemId, itemType, userEmail) {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: userEmail, isActive: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const userId = user.id;
      let item = null;

      const includeMatches = {
        model: Match,
        as: itemType === "found" ? "foundMatches" : "lostMatches",
        include: [
          {
            model: itemType === "found" ? LostItem : FoundItem,
            as: itemType === "found" ? "lostItem" : "foundItem",
            include: [
              {
                model: User,
                as: itemType === "found" ? "owner" : "finder",
                attributes: ["id", "firstName", "lastName", "whatsappNumber"],
              },
            ],
          },
        ],
      };

      const includeClaims = {
        model: Claim,
        as: "claims",
        include: [
          {
            model: User,
            as: "claimer",
            attributes: ["id", "firstName", "lastName", "whatsappNumber"],
          },
        ],
      };

      if (itemType === "found") {
        item = await FoundItem.findOne({
          where: { id: itemId, userId },
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
            includeMatches,
            includeClaims,
          ],
        });
      } else if (itemType === "lost") {
        item = await LostItem.findOne({
          where: { id: itemId, userId },
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
            includeMatches,
          ],
        });
      }

      if (!item) {
        throw new Error("Item not found or access denied");
      }

      logger.info(
        `Retrieved ${itemType} item detail: ${itemId} for user ${userEmail}`
      );

      return {
        ...item.toJSON(),
        type: itemType,
        itemType: itemType,
        isOwner: true,
      };
    } catch (error) {
      logger.error(`Error getting item detail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update item status by owner
   * @param {string} itemId - Item ID
   * @param {string} itemType - Type (found/lost)
   * @param {string} newStatus - New status
   * @param {string} userEmail - Owner email
   * @returns {Promise<boolean>} Success status
   */
  static async updateItemStatusByOwner(itemId, itemType, newStatus, userEmail) {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: userEmail, isActive: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const userId = user.id;
      let updateResult = null;

      if (itemType === "found") {
        updateResult = await FoundItem.update(
          { status: newStatus, updatedAt: new Date() },
          { where: { id: itemId, userId } }
        );
      } else if (itemType === "lost") {
        updateResult = await LostItem.update(
          { status: newStatus, updatedAt: new Date() },
          { where: { id: itemId, userId } }
        );
      }

      if (!updateResult || updateResult[0] === 0) {
        throw new Error("Item not found or access denied");
      }

      logger.info(
        `Updated ${itemType} item ${itemId} status to ${newStatus} for user ${userEmail}`
      );
      return true;
    } catch (error) {
      logger.error(`Error updating item status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete item by owner
   * @param {string} itemId - Item ID
   * @param {string} itemType - Type (found/lost)
   * @param {string} userEmail - Owner email
   * @returns {Promise<boolean>} Success status
   */
  static async deleteItemByOwner(itemId, itemType, userEmail) {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: userEmail, isActive: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const userId = user.id;
      let deleteResult = null;

      // First check if item has active matches or claims
      if (itemType === "found") {
        const activeMatches = await Match.count({
          where: { foundItemId: itemId, status: "pending" },
        });
        const activeClaims = await Claim.count({
          where: { foundItemId: itemId, status: "pending" },
        });

        if (activeMatches > 0 || activeClaims > 0) {
          throw new Error("Cannot delete item with active matches or claims");
        }

        deleteResult = await FoundItem.destroy({
          where: { id: itemId, userId },
        });
      } else if (itemType === "lost") {
        const activeMatches = await Match.count({
          where: { lostItemId: itemId, status: "pending" },
        });

        if (activeMatches > 0) {
          throw new Error("Cannot delete item with active matches");
        }

        deleteResult = await LostItem.destroy({
          where: { id: itemId, userId },
        });
      }

      if (!deleteResult) {
        throw new Error("Item not found or access denied");
      }

      logger.info(`Deleted ${itemType} item ${itemId} for user ${userEmail}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting item: ${error.message}`);
      throw error;
    }
  }

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
