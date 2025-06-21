const express = require("express");
const router = express.Router();
const MatchController = require("../controllers/match.controller");
const AuthMiddleware = require("../middlewares/auth.middleware");

router.get(
  "/",
  AuthMiddleware.authenticateToken,
  MatchController.getUserMatches
);

router.get(
  "/latest-matches",
  AuthMiddleware.authenticateToken,
  MatchController.getLatestMatches
);

router.get(
  "/:id",
  AuthMiddleware.authenticateToken,
  MatchController.getMatchDetail
);
router.put(
  "/:id/status",
  AuthMiddleware.authenticateToken,
  MatchController.updateMatchStatus
);
router.post(
  "/trigger-manual",
  AuthMiddleware.authenticateToken,
  MatchController.triggerManualMatching
);

router.post(
  "/force",
  AuthMiddleware.authenticateToken,
  MatchController.forceMatch
);

// Alias untuk kemudahan penggunaan
router.get(
  "/lost-item/:itemId",
  AuthMiddleware.authenticateToken,
  (req, res, next) => {
    req.query.type = "lost";
    req.query.itemId = req.params.itemId;
    next();
  },
  MatchController.getUserMatches
);

router.get(
  "/found-item/:itemId",
  AuthMiddleware.authenticateToken,
  (req, res, next) => {
    req.query.type = "found";
    req.query.itemId = req.params.itemId;
    next();
  },
  MatchController.getUserMatches
);

module.exports = router;
