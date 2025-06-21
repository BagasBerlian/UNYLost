const Match = require("../models/match.model");
const LostItem = require("../models/lost-item.model");
const FoundItem = require("../models/found-item.model");
const User = require("../models/user.model");
const { Op } = require("sequelize");

class MatchService {
  async getUserMatches(userId, filters = {}) {
    try {
      const { type, itemId, page = 1, limit = 10 } = filters;
      const offset = (page - 1) * limit;

      let whereClause = {};

      // Filter untuk spesifik item
      if (itemId) {
        if (type === "lost") {
          whereClause.lostItemId = itemId;
        } else if (type === "found") {
          whereClause.foundItemId = itemId;
        }
      } else {
        // Filter untuk semua item milik user
        const userLostItems = await LostItem.findAll({
          where: { userId },
          attributes: ["id"],
        });

        const userFoundItems = await FoundItem.findAll({
          where: { userId },
          attributes: ["id"],
        });

        const lostItemIds = userLostItems.map((item) => item.id);
        const foundItemIds = userFoundItems.map((item) => item.id);

        if (type === "lost") {
          whereClause.lostItemId = { [Op.in]: lostItemIds };
        } else if (type === "found") {
          whereClause.foundItemId = { [Op.in]: foundItemIds };
        } else {
          // Gabungkan keduanya
          whereClause = {
            [Op.or]: [
              { lostItemId: { [Op.in]: lostItemIds } },
              { foundItemId: { [Op.in]: foundItemIds } },
            ],
          };
        }
      }

      const matches = await Match.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["similarity", "DESC"]],
        include: [
          {
            model: LostItem,
            include: [
              { model: User, attributes: ["id", "firstName", "lastName"] },
            ],
          },
          {
            model: FoundItem,
            include: [
              { model: User, attributes: ["id", "firstName", "lastName"] },
            ],
          },
        ],
      });

      return {
        items: matches.rows,
        total: matches.count,
        page,
        totalPages: Math.ceil(matches.count / limit),
      };
    } catch (error) {
      throw error;
    }
  }

  async getMatchDetail(matchId, userId) {
    try {
      const match = await Match.findByPk(matchId, {
        include: [
          {
            model: LostItem,
            include: [
              { model: User, attributes: ["id", "firstName", "lastName"] },
            ],
          },
          {
            model: FoundItem,
            include: [
              { model: User, attributes: ["id", "firstName", "lastName"] },
            ],
          },
        ],
      });

      if (!match) return null;

      // Verifikasi kepemilikan item
      const lostItem = match.LostItem;
      const foundItem = match.FoundItem;

      if (lostItem.userId !== userId && foundItem.userId !== userId) {
        throw new Error("Anda tidak memiliki akses ke match ini");
      }

      return match;
    } catch (error) {
      throw error;
    }
  }

  async updateMatchStatus(matchId, status, userId) {
    try {
      const match = await Match.findByPk(matchId, {
        include: [{ model: LostItem }, { model: FoundItem }],
      });

      if (!match) {
        throw new Error("Match tidak ditemukan");
      }

      // Verifikasi kepemilikan item
      const lostItem = match.LostItem;
      const foundItem = match.FoundItem;

      if (lostItem.userId !== userId && foundItem.userId !== userId) {
        throw new Error("Anda tidak memiliki akses ke match ini");
      }

      // Update status
      if (status === "claimed") {
        await match.claim();
      } else if (status === "expired") {
        await match.expire();
      } else {
        throw new Error("Status tidak valid");
      }

      return match;
    } catch (error) {
      throw error;
    }
  }

  async processAIMatches(aiMatches, itemId, type) {
    try {
      console.log(
        `Processing ${aiMatches.length} matches for ${type} item ${itemId}`
      );
      const createdMatches = [];

      for (const aiMatch of aiMatches) {
        try {
          let match;
          console.log(
            `Processing match with ${aiMatch.id}, similarity: ${aiMatch.similarity}`
          );

          // Cek apakah ini self-match
          if (aiMatch.id === itemId) {
            console.log(`Skipping self-match for item: ${itemId}`);
            continue;
          }

          // Tentukan lost item dan found item berdasarkan tipe item saat ini
          if (type === "lost") {
            // Item yang diberikan adalah lost item
            match = await this.createMatch(
              itemId,
              aiMatch.id,
              aiMatch.similarity,
              aiMatch.match_type || "hybrid"
            );
          } else {
            // Item yang diberikan adalah found item
            match = await this.createMatch(
              aiMatch.id,
              itemId,
              aiMatch.similarity,
              aiMatch.match_type || "hybrid"
            );
          }

          if (match) {
            createdMatches.push(match);
          }
        } catch (matchError) {
          console.error(
            `Error creating match for item ${itemId} with ${aiMatch.id}:`,
            matchError
          );
          // Lanjutkan ke match berikutnya meskipun ada error
        }
      }

      console.log(`Created ${createdMatches.length} matches in database`);
      return createdMatches;
    } catch (error) {
      console.error("Error processing AI matches:", error);
      throw error;
    }
  }

  async createMatch(lostItemId, foundItemId, similarity, matchType = "hybrid") {
    try {
      console.log(
        `Creating match: lost=${lostItemId}, found=${foundItemId}, sim=${similarity}`
      );

      if (lostItemId === foundItemId) {
        console.log(`Skipping self-match for item: ${lostItemId}`);
        return null;
      }

      // Periksa apakah item ada di database
      const lostItem = await LostItem.findByPk(lostItemId);
      const foundItem = await FoundItem.findByPk(foundItemId);

      console.log(
        `Lost item lookup result: ${lostItem ? "found" : "not found"}`
      );
      console.log(
        `Found item lookup result: ${foundItem ? "found" : "not found"}`
      );

      if (!lostItem) {
        console.log(
          `Lost item ${lostItemId} tidak ditemukan, mencoba mencari di Firebase...`
        );
      }

      if (!foundItem) {
        console.log(
          `Found item ${foundItemId} tidak ditemukan, mencoba mencari di Firebase...`
        );
      }

      if (!lostItem || !foundItem) {
        console.log(
          `Skip match creation: lost=${
            !lostItem ? "not found" : "found"
          }, found=${!foundItem ? "not found" : "found"}`
        );
        return null;
      }

      // Periksa apakah match sudah ada
      const existingMatch = await Match.findOne({
        where: {
          lostItemId,
          foundItemId,
        },
      });

      if (existingMatch) {
        // Update similarity jika lebih tinggi
        if (similarity > existingMatch.similarity) {
          existingMatch.similarity = similarity;
          existingMatch.matchType = matchType;
          await existingMatch.save();
          console.log(
            `Updated existing match with higher similarity: ${similarity}`
          );
        }
        return existingMatch;
      }

      // Buat match baru
      const match = await Match.create({
        lostItemId,
        foundItemId,
        similarity,
        matchType,
        status: "pending",
        detectedAt: new Date(),
        matchingVersion: "1.0",
      });

      console.log(`New match created with ID: ${match.id}`);

      // Update status item
      if (lostItem) {
        lostItem.status = "has_matches";
        lostItem.lastMatchedAt = new Date();
        await lostItem.save();
      }

      if (foundItem) {
        foundItem.lastMatchedAt = new Date();
        await foundItem.save();
      }

      return match;
    } catch (error) {
      console.error("Error creating match:", error);
      throw error;
    }
  }

  async verifyItemOwnership(itemId, type, userId) {
    try {
      let item = null;

      if (type === "lost") {
        item = await LostItem.findOne({
          where: { id: itemId, userId },
        });
      } else if (type === "found") {
        item = await FoundItem.findOne({
          where: { id: itemId, userId },
        });
      }

      return item;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new MatchService();
