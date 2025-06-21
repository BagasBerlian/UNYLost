const MatchService = require("../../services/match.service");
const AIService = require("../../services/ai.service");
const Match = require("../../models/match.model");
const LostItem = require("../../models/lost-item.model");
const FoundItem = require("../../models/found-item.model");
const User = require("../../models/user.model");

class MatchController {
  async getUserMatches(req, res, next) {
    try {
      const userId = req.user.id;
      const { type, itemId, page = 1, limit = 10 } = req.query;

      const matches = await MatchService.getUserMatches(userId, {
        type,
        itemId,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.status(200).json({
        success: true,
        data: matches,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchDetail(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const match = await MatchService.getMatchDetail(id, userId);

      if (!match) {
        return res.status(404).json({
          success: false,
          error: "Match tidak ditemukan",
        });
      }

      res.status(200).json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMatchStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const result = await MatchService.updateMatchStatus(id, status, userId);

      res.status(200).json({
        success: true,
        message: "Status match berhasil diperbarui",
        data: {
          id,
          status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerManualMatching(req, res, next) {
    try {
      const { itemId, type } = req.body;
      const userId = req.user.id;

      // Verifikasi kepemilikan item
      const item = await MatchService.verifyItemOwnership(itemId, type, userId);

      if (!item) {
        return res.status(403).json({
          success: false,
          error: "Item tidak ditemukan atau Anda tidak memiliki akses",
        });
      }

      // Trigger AI matching
      const result = await AIService.triggerItemMatching(item, type);

      // Simpan hasil ke database
      const matches = await MatchService.processAIMatches(
        result.data.matches,
        itemId,
        type
      );

      res.status(200).json({
        success: true,
        message: "Pencarian kecocokan berhasil dijalankan",
        data: {
          matchCount: matches.length,
          hasHighSimilarity: matches.some((m) => m.similarity >= 0.85),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatestMatches(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;

      // Ambil matches terbaru
      const matches = await Match.findAll({
        limit,
        order: [["createdAt", "DESC"]],
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

      if (!matches || matches.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Belum ada match yang ditemukan",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          matches,
          count: matches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async forceMatch(req, res, next) {
    try {
      const { lostItemId, foundItemId, similarity = 0.85 } = req.body;

      if (!lostItemId || !foundItemId) {
        return res.status(400).json({
          success: false,
          error: "lostItemId dan foundItemId harus disediakan",
        });
      }

      // Buat match secara manual
      const match = await MatchService.createMatch(
        lostItemId,
        foundItemId,
        similarity,
        "hybrid"
      );

      if (!match) {
        return res.status(400).json({
          success: false,
          error: "Gagal membuat match. Periksa apakah kedua item ada",
        });
      }

      res.status(201).json({
        success: true,
        message: "Match berhasil dibuat secara manual",
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MatchController();
