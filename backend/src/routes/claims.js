const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

const { Claim, FoundItem, User, LostItem } = require("../models");
const auth = require("../middleware/auth");
const logger = require("../utils/logger");
const { NotificationService } = require("../services/NotificationService");

const router = express.Router();

// Validation rules
const createClaimValidation = [
  param("foundItemId").isUUID().withMessage("Invalid found item ID"),
  body("story")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Story must be between 10-1000 characters"),
];

const reviewClaimValidation = [
  param("id").isUUID().withMessage("Invalid claim ID"),
  body("action")
    .isIn(["approve", "reject"])
    .withMessage("Action must be approve or reject"),
  body("rejectionReason")
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage(
      "Rejection reason must be between 5-500 characters if provided"
    ),
];

/**
 * @route   POST /api/claims/:foundItemId
 * @desc    Create claim for found item
 * @access  Private
 */
router.post("/:foundItemId", auth, createClaimValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { foundItemId } = req.params;
    const { story } = req.body;

    // Check if found item exists and is available
    const foundItem = await FoundItem.findOne({
      where: {
        id: foundItemId,
        status: "available",
      },
      include: [
        {
          model: User,
          as: "finder",
          attributes: [
            "id",
            "fullName",
            "whatsappNumber",
            "notificationSettings",
          ],
        },
      ],
    });

    if (!foundItem) {
      return res.status(404).json({
        success: false,
        message: "Found item not available for claiming",
        code: "ITEM_NOT_AVAILABLE",
      });
    }

    // Check if user is not the finder
    if (foundItem.userId === req.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot claim your own found item",
        code: "CANNOT_CLAIM_OWN_ITEM",
      });
    }

    // Check if user already has a pending claim for this item
    const existingClaim = await Claim.findOne({
      where: {
        foundItemId,
        claimerId: req.userId,
        status: "pending",
      },
    });

    if (existingClaim) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending claim for this item",
        code: "CLAIM_EXISTS",
      });
    }

    // Create claim
    const claim = await Claim.create({
      foundItemId,
      claimerId: req.userId,
      story: story.trim(),
      status: "pending",
    });

    // Update found item status
    await foundItem.update({ status: "pending_claim" });

    // Get claimer info for notification
    const claimer = await User.findByPk(req.userId, {
      attributes: ["id", "fullName", "email", "whatsappNumber"],
    });

    // Send notification to finder
    await NotificationService.sendClaimReceivedNotification(
      foundItem.finder,
      foundItem,
      claim,
      claimer
    );

    // Get created claim with relations
    const createdClaim = await Claim.findByPk(claim.id, {
      include: [
        {
          model: User,
          as: "claimer",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: FoundItem,
          as: "foundItem",
          attributes: ["id", "itemName", "description", "locationFound"],
        },
      ],
    });

    logger.info(`New claim created: ${claim.id} for found item ${foundItemId}`);

    res.status(201).json({
      success: true,
      message: "Claim submitted successfully",
      data: {
        claim: createdClaim,
      },
    });
  } catch (error) {
    logger.error("Create claim error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create claim",
      code: "CREATE_CLAIM_ERROR",
    });
  }
});

router.get("/my-claims", auth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const claims = await Claim.findAll({
      where: {
        claimingUserId: userId, // <-- Filter berdasarkan ID user yang membuat klaim
      },
      include: [
        {
          model: Item, // Sertakan detail item yang diklaim
          as: "item",
          include: [
            { model: Image, as: "images", attributes: ["url"] }, // Sertakan juga gambar item
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!claims) {
      return res
        .status(404)
        .json({ message: "No claims found for this user." });
    }

    res.status(200).json(claims);
  } catch (error) {
    console.error("Error fetching user claims:", error);
    next(error);
  }
});

/**
 * @route   GET /api/claims/my
 * @desc    Get user's claims
 * @access  Private
 */
router.get(
  "/my",
  auth,
  [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Invalid status"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1-50"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Build where clause
      const where = { claimerId: req.userId };
      if (status) where.status = status;

      // Get claims
      const { count, rows: claims } = await Claim.findAndCountAll({
        where,
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            attributes: [
              "id",
              "itemName",
              "description",
              "locationFound",
              "images",
              "status",
            ],
            include: [
              {
                model: User,
                as: "finder",
                attributes: ["id", "fullName"],
              },
            ],
          },
          {
            model: User,
            as: "reviewer",
            attributes: ["id", "fullName"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: {
          claims,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get my claims error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch claims",
        code: "GET_CLAIMS_ERROR",
      });
    }
  }
);

/**
 * @route   GET /api/claims/received
 * @desc    Get claims received for user's found items
 * @access  Private
 */
router.get(
  "/received",
  auth,
  [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Invalid status"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1-50"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Build where clause for found items
      const foundItemWhere = { userId: req.userId };
      const claimWhere = {};
      if (status) claimWhere.status = status;

      // Get claims for user's found items
      const { count, rows: claims } = await Claim.findAndCountAll({
        where: claimWhere,
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            where: foundItemWhere,
            attributes: [
              "id",
              "itemName",
              "description",
              "locationFound",
              "images",
              "status",
            ],
          },
          {
            model: User,
            as: "claimer",
            attributes: ["id", "fullName", "email", "whatsappNumber"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: {
          claims,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get received claims error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch received claims",
        code: "GET_RECEIVED_CLAIMS_ERROR",
      });
    }
  }
);

/**
 * @route   GET /api/claims/:id
 * @desc    Get claim details
 * @access  Private
 */
router.get(
  "/:id",
  auth,
  [param("id").isUUID().withMessage("Invalid claim ID")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { id } = req.params;

      const claim = await Claim.findByPk(id, {
        include: [
          {
            model: FoundItem,
            as: "foundItem",
            attributes: [
              "id",
              "itemName",
              "description",
              "locationFound",
              "foundDate",
              "foundTime",
              "images",
              "status",
            ],
            include: [
              {
                model: User,
                as: "finder",
                attributes: ["id", "fullName", "email", "whatsappNumber"],
              },
            ],
          },
          {
            model: User,
            as: "claimer",
            attributes: ["id", "fullName", "email", "whatsappNumber"],
          },
          {
            model: User,
            as: "reviewer",
            attributes: ["id", "fullName"],
          },
        ],
      });

      if (!claim) {
        return res.status(404).json({
          success: false,
          message: "Claim not found",
          code: "CLAIM_NOT_FOUND",
        });
      }

      // Check if user has access to this claim
      const hasAccess =
        claim.claimerId === req.userId || // claimer
        claim.foundItem.finder.id === req.userId; // finder

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
          code: "ACCESS_DENIED",
        });
      }

      // Hide sensitive info based on user role
      if (claim.claimerId !== req.userId) {
        // If user is finder, hide claimer's sensitive info until approved
        if (claim.status !== "approved") {
          claim.claimer.email = undefined;
          claim.claimer.whatsappNumber = undefined;
        }
      }

      if (claim.foundItem.finder.id !== req.userId) {
        // If user is claimer, hide finder's sensitive info until approved
        if (claim.status !== "approved") {
          claim.foundItem.finder.email = undefined;
          claim.foundItem.finder.whatsappNumber = undefined;
        }
      }

      res.json({
        success: true,
        data: { claim },
      });
    } catch (error) {
      logger.error("Get claim details error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch claim details",
        code: "GET_CLAIM_ERROR",
      });
    }
  }
);

/**
 * @route   PUT /api/claims/:id/review
 * @desc    Review claim (approve/reject)
 * @access  Private
 */
router.put("/:id/review", auth, reviewClaimValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    // Find claim with related data
    const claim = await Claim.findByPk(id, {
      include: [
        {
          model: FoundItem,
          as: "foundItem",
          include: [
            {
              model: User,
              as: "finder",
              attributes: ["id", "fullName"],
            },
          ],
        },
        {
          model: User,
          as: "claimer",
          attributes: [
            "id",
            "fullName",
            "whatsappNumber",
            "notificationSettings",
          ],
        },
      ],
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
        code: "CLAIM_NOT_FOUND",
      });
    }

    // Check if user is the finder
    if (claim.foundItem.finder.id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the finder can review claims",
        code: "ACCESS_DENIED",
      });
    }

    // Check if claim is still pending
    if (claim.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Claim has already been reviewed",
        code: "CLAIM_ALREADY_REVIEWED",
      });
    }

    // Validate rejection reason for reject action
    if (action === "reject" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a claim",
        code: "REJECTION_REASON_REQUIRED",
      });
    }

    // Update claim
    const updateData = {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewerId: req.userId,
    };

    if (action === "reject") {
      updateData.rejectionReason = rejectionReason.trim();
    }

    await claim.update(updateData);

    // Update found item status
    if (action === "approve") {
      await claim.foundItem.update({ status: "claimed" });
    } else {
      await claim.foundItem.update({ status: "available" });
    }

    // Send notification to claimer
    if (action === "approve") {
      await NotificationService.sendClaimApprovedNotification(
        claim.claimer,
        claim.foundItem,
        claim,
        claim.foundItem.finder
      );
    } else {
      await NotificationService.sendClaimRejectedNotification(
        claim.claimer,
        claim.foundItem,
        claim,
        rejectionReason
      );
    }

    logger.info(`Claim ${action}ed: ${id} by user ${req.userId}`);

    // Get updated claim
    const updatedClaim = await Claim.findByPk(id, {
      include: [
        {
          model: FoundItem,
          as: "foundItem",
          attributes: ["id", "itemName", "status"],
        },
        {
          model: User,
          as: "claimer",
          attributes: ["id", "fullName", "email", "whatsappNumber"],
        },
        {
          model: User,
          as: "reviewer",
          attributes: ["id", "fullName"],
        },
      ],
    });

    res.json({
      success: true,
      message: `Claim ${action}ed successfully`,
      data: {
        claim: updatedClaim,
      },
    });
  } catch (error) {
    logger.error("Review claim error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review claim",
      code: "REVIEW_CLAIM_ERROR",
    });
  }
});

/**
 * @route   DELETE /api/claims/:id
 * @desc    Cancel pending claim
 * @access  Private
 */
router.delete(
  "/:id",
  auth,
  [param("id").isUUID().withMessage("Invalid claim ID")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { id } = req.params;

      // Find claim
      const claim = await Claim.findByPk(id, {
        include: [
          {
            model: FoundItem,
            as: "foundItem",
          },
        ],
      });

      if (!claim) {
        return res.status(404).json({
          success: false,
          message: "Claim not found",
          code: "CLAIM_NOT_FOUND",
        });
      }

      // Check if user is the claimer
      if (claim.claimerId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own claims",
          code: "ACCESS_DENIED",
        });
      }

      // Check if claim is still pending
      if (claim.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Only pending claims can be cancelled",
          code: "CANNOT_CANCEL_CLAIM",
        });
      }

      // Delete claim
      await claim.destroy();

      // Update found item status back to available if no other pending claims
      const otherPendingClaims = await Claim.count({
        where: {
          foundItemId: claim.foundItemId,
          status: "pending",
        },
      });

      if (otherPendingClaims === 0) {
        await claim.foundItem.update({ status: "available" });
      }

      logger.info(`Claim cancelled: ${id} by user ${req.userId}`);

      res.json({
        success: true,
        message: "Claim cancelled successfully",
      });
    } catch (error) {
      logger.error("Cancel claim error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel claim",
        code: "CANCEL_CLAIM_ERROR",
      });
    }
  }
);

module.exports = router;
