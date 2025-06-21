const express = require("express");
const router = express.Router();
const multer = require("multer");
const ItemController = require("../controllers/item.controller");
const AuthMiddleware = require("../middlewares/auth.middleware");

// Setup multer untuk file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Rute publik untuk health check
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Item routes working",
  });
});

// Rute yang dilindungi (perlu login)
router.post(
  "/lost",
  AuthMiddleware.authenticateToken,
  AuthMiddleware.requireVerification,
  upload.array("images", 5),
  ItemController.createLostItem
);
router.post(
  "/found",
  AuthMiddleware.authenticateToken,
  AuthMiddleware.requireVerification,
  upload.array("images", 5),
  ItemController.createFoundItem
);
router.get(
  "/my-items",
  AuthMiddleware.authenticateToken,
  ItemController.getUserItems
);
router.get(
  "/lost/:id",
  AuthMiddleware.authenticateToken,
  (req, res, next) => {
    req.query.type = "lost";
    next();
  },
  ItemController.getItemById
);
router.get(
  "/found/:id",
  AuthMiddleware.authenticateToken,
  (req, res, next) => {
    req.query.type = "found";
    next();
  },
  ItemController.getItemById
);
router.put(
  "/:id/status",
  AuthMiddleware.authenticateToken,
  ItemController.updateItemStatus
);
router.delete(
  "/:id",
  AuthMiddleware.authenticateToken,
  ItemController.deleteItem
);
router.post(
  "/upload-images",
  AuthMiddleware.authenticateToken,
  upload.array("images", 5),
  ItemController.uploadItemImages
);

module.exports = router;
