const ItemService = require("../../services/item.service");
const FileService = require("../../services/file.service");
const AIService = require("../../services/ai.service");
const MatchService = require("../../services/match.service");

class ItemController {
  async createLostItem(req, res, next) {
    try {
      const userId = req.user.id;
      const itemData = req.body;
      const files = req.files || [];

      // Upload gambar jika ada
      if (files.length > 0) {
        console.log(`Uploading ${files.length} files for lost item`);
        // Gunakan kategori item saat upload
        const imageUrls = await FileService.uploadMultipleFiles(
          files,
          "lost_items",
          itemData.category || "others"
        );
        itemData.images = imageUrls;
        console.log("Uploaded image URLs:", imageUrls);
      }

      const lostItem = await ItemService.createLostItem(userId, itemData);
      let matchesCount = 0;

      // Proses dengan AI Layer
      try {
        // Cek koneksi ke AI Layer
        await AIService.healthCheck();

        // Kirim item ke AI Layer untuk matching
        const aiResult = await AIService.processLostItem(lostItem);
        console.log("AI Matching result:", aiResult);

        // Jika ada data match, proses dan simpan ke database
        if (aiResult && aiResult.data && aiResult.data.matches) {
          const matches = await MatchService.processAIMatches(
            aiResult.data.matches,
            lostItem.id,
            "lost"
          );
          matchesCount = matches.length;

          // Update item jika ada match
          if (matchesCount > 0) {
            lostItem.status = "has_matches";
            lostItem.lastMatchedAt = new Date();
            await lostItem.save();
          }
        }
      } catch (aiError) {
        console.error("AI processing error:", aiError);
        // Lanjutkan meskipun proses AI gagal
      }

      res.status(201).json({
        success: true,
        message: "Laporan barang hilang berhasil dibuat",
        data: {
          itemId: lostItem.id,
          itemName: lostItem.itemName,
          status: lostItem.status,
          createdAt: lostItem.createdAt,
          matchesCount: matchesCount,
          imageUrls: lostItem.images,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async createFoundItem(req, res, next) {
    try {
      const userId = req.user.id;
      const itemData = req.body;
      const files = req.files || [];

      // Upload gambar jika ada
      if (files.length > 0) {
        console.log(`Uploading ${files.length} files for found item`);
        // Gunakan kategori item saat upload
        const imageUrls = await FileService.uploadMultipleFiles(
          files,
          "found_items",
          itemData.category || "others"
        );
        itemData.images = imageUrls;
        console.log("Uploaded image URLs:", imageUrls);
      }

      const foundItem = await ItemService.createFoundItem(userId, itemData);
      let matchesCount = 0;

      // Proses dengan AI Layer
      try {
        // Cek koneksi ke AI Layer
        await AIService.healthCheck();

        // Kirim item ke AI Layer untuk matching
        const aiResult = await AIService.processFoundItem(foundItem);
        console.log("AI Matching result:", aiResult);

        // Jika ada data match, proses dan simpan ke database
        if (aiResult && aiResult.data && aiResult.data.matches) {
          const matches = await MatchService.processAIMatches(
            aiResult.data.matches,
            foundItem.id,
            "found"
          );
          matchesCount = matches.length;

          // Update item jika ada match
          if (matchesCount > 0) {
            foundItem.lastMatchedAt = new Date();
            await foundItem.save();
          }
        }
      } catch (aiError) {
        console.error("AI processing error:", aiError);
        // Lanjutkan meskipun proses AI gagal
      }

      res.status(201).json({
        success: true,
        message: "Laporan barang temuan berhasil dibuat",
        data: {
          itemId: foundItem.id,
          itemName: foundItem.itemName,
          status: foundItem.status,
          createdAt: foundItem.createdAt,
          matchesCount: matchesCount,
          imageUrls: foundItem.images,
        },
      });
    } catch (error) {
      next(error);
    }
  }
  async getUserItems(req, res, next) {
    try {
      const userId = req.user.id;
      const { type = "all", status, page = 1, limit = 10 } = req.query;

      const items = await ItemService.getUserItems(userId, {
        type,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  async getItemById(req, res, next) {
    try {
      const { id } = req.params;
      const { type } = req.query;

      const item = await ItemService.getItemById(id, type);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: "Item tidak ditemukan",
        });
      }

      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateItemStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const result = await ItemService.updateItemStatus(id, status, userId);

      res.status(200).json({
        success: true,
        message: "Status item berhasil diperbarui",
        data: {
          id,
          status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteItem(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await ItemService.deleteItem(id, userId);

      res.status(200).json({
        success: true,
        message: "Item berhasil dihapus",
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadItemImages(req, res, next) {
    try {
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Tidak ada file yang diunggah",
        });
      }

      const imageUrls = await FileService.uploadMultipleFiles(files);

      res.status(200).json({
        success: true,
        message: "Gambar berhasil diunggah",
        data: {
          imageUrls,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ItemController();
