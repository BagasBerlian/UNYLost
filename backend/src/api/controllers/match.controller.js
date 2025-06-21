const MatchService = require("../../services/match.service");
const AIService = require("../../services/ai.service");

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
}

module.exports = new MatchController();
