const LostItem = require("../models/lost-item.model");
const FoundItem = require("../models/found-item.model");
const User = require("../models/user.model");
const { Op } = require("sequelize");

class ItemService {
  async createLostItem(userId, itemData) {
    try {
      const lostItem = await LostItem.create({
        userId,
        ...itemData,
      });

      return lostItem;
    } catch (error) {
      throw error;
    }
  }

  async createFoundItem(userId, itemData) {
    try {
      const foundItem = await FoundItem.create({
        userId,
        ...itemData,
      });

      return foundItem;
    } catch (error) {
      throw error;
    }
  }

  async getUserItems(userId, filters = {}) {
    try {
      const { type = "all", status, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      const whereClause = { userId };
      if (status) whereClause.status = status;

      let result = {};

      if (type === "lost" || type === "all") {
        const lostItems = await LostItem.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [["createdAt", "DESC"]],
        });

        result.lostItems = {
          items: lostItems.rows,
          total: lostItems.count,
          page,
          totalPages: Math.ceil(lostItems.count / limit),
        };
      }

      if (type === "found" || type === "all") {
        const foundItems = await FoundItem.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [["createdAt", "DESC"]],
        });

        result.foundItems = {
          items: foundItems.rows,
          total: foundItems.count,
          page,
          totalPages: Math.ceil(foundItems.count / limit),
        };
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getItemById(itemId, type) {
    try {
      let item = null;

      if (type === "lost") {
        item = await LostItem.findByPk(itemId, {
          include: [
            {
              model: User,
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        });
      } else if (type === "found") {
        item = await FoundItem.findByPk(itemId, {
          include: [
            {
              model: User,
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        });
      } else {
        // Coba cari di kedua tabel
        item = await LostItem.findByPk(itemId, {
          include: [
            {
              model: User,
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        });

        if (!item) {
          item = await FoundItem.findByPk(itemId, {
            include: [
              {
                model: User,
                attributes: ["id", "firstName", "lastName", "email"],
              },
            ],
          });
        }
      }

      return item;
    } catch (error) {
      throw error;
    }
  }

  async updateItemStatus(itemId, status, userId) {
    try {
      // Coba update lost item
      let item = await LostItem.findOne({
        where: { id: itemId, userId },
      });

      if (item) {
        await item.updateStatus(status);
        return { type: "lost", item };
      }

      // Coba update found item
      item = await FoundItem.findOne({
        where: { id: itemId, userId },
      });

      if (item) {
        await item.updateStatus(status);
        return { type: "found", item };
      }

      throw new Error("Item tidak ditemukan atau Anda tidak memiliki akses");
    } catch (error) {
      throw error;
    }
  }

  async deleteItem(itemId, userId) {
    try {
      // Coba hapus lost item
      let deleted = await LostItem.destroy({
        where: { id: itemId, userId },
      });

      if (deleted) return { type: "lost", deleted };

      // Coba hapus found item
      deleted = await FoundItem.destroy({
        where: { id: itemId, userId },
      });

      if (deleted) return { type: "found", deleted };

      throw new Error("Item tidak ditemukan atau Anda tidak memiliki akses");
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ItemService();
