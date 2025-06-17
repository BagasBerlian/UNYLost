// File: backend/src/routes/matches.js - API Routes untuk Matches
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const MatchService = require('../services/MatchService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/matches/my-matches
 * Get user's matches
 */
router.get('/my-matches',
  auth,
  [
    query('status').optional().isIn(['pending', 'claimed', 'approved', 'rejected', 'expired']).withMessage('Invalid status'),
    query('type').optional().isIn(['found', 'lost', 'all']).withMessage('Invalid type'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { status, type = 'all', page = 1, limit = 10 } = req.query;

      logger.info(`Getting matches for user ${userId}, type: ${type}, status: ${status}`);

      const result = await MatchService.getUserMatches(userId, {
        status,
        type,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.matches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error(`Error getting user matches: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get matches',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/matches/:id
 * Get specific match details
 */
router.get('/:id',
  auth,
  [
    param('id').isUUID().withMessage('Invalid match ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;

      const match = await MatchService.getMatchDetail(id, userId);

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found or access denied'
        });
      }

      res.json({
        success: true,
        data: match
      });

    } catch (error) {
      logger.error(`Error getting match detail: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get match detail',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * PUT /api/matches/:id/claim
 * Claim a match (by lost item owner)
 */
router.put('/:id/claim',
  auth,
  [
    param('id').isUUID().withMessage('Invalid match ID'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message too long (max 500 characters)')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const { message } = req.body;

      logger.info(`User ${userId} claiming match ${id}`);

      const success = await MatchService.updateMatchStatus(id, 'claimed', userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Match not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Match claimed successfully. Waiting for finder approval.'
      });

    } catch (error) {
      logger.error(`Error claiming match: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to claim match',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * PUT /api/matches/:id/approve
 * Approve a match claim (by found item owner)
 */
router.put('/:id/approve',
  auth,
  [
    param('id').isUUID().withMessage('Invalid match ID'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message too long (max 500 characters)')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const { message } = req.body;

      logger.info(`User ${userId} approving match ${id}`);

      const success = await MatchService.updateMatchStatus(id, 'approved', userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Match not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Match approved successfully. Contact information shared.'
      });

    } catch (error) {
      logger.error(`Error approving match: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to approve match',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * PUT /api/matches/:id/reject
 * Reject a match claim
 */
router.put('/:id/reject',
  auth,
  [
    param('id').isUUID().withMessage('Invalid match ID'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long (max 500 characters)')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      logger.info(`User ${userId} rejecting match ${id}`);

      const success = await MatchService.updateMatchStatus(id, 'rejected', userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Match not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Match rejected successfully.'
      });

    } catch (error) {
      logger.error(`Error rejecting match: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to reject match',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/matches/ai-notification
 * Receive AI notifications (internal endpoint)
 */
router.post('/ai-notification',
  [
    body('item_id').isUUID().withMessage('Invalid item ID'),
    body('collection').isIn(['found_items', 'lost_items']).withMessage('Invalid collection'),
    body('matches').isArray().withMessage('Matches must be an array'),
    body('timestamp').isISO8601().withMessage('Invalid timestamp')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      logger.info(`Received AI notification for ${req.body.collection} item ${req.body.item_id}`);

      const success = await MatchService.handleAINotification(req.body);

      if (success) {
        res.json({
          success: true,
          message: 'AI notification processed successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to process AI notification'
        });
      }

    } catch (error) {
      logger.error(`Error processing AI notification: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to process AI notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/matches/trending
 * Get trending high-similarity matches
 */
router.get('/trending',
  auth,
  [
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1-20'),
    query('threshold').optional().isFloat({ min: 0.5, max: 1.0 }).withMessage('Threshold must be between 0.5-1.0')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { limit = 10, threshold = 0.8 } = req.query;

      const trending = await MatchService.getTrendingMatches({
        limit: parseInt(limit),
        threshold: parseFloat(threshold)
      });

      res.json({
        success: true,
        data: trending,
        meta: {
          count: trending.length,
          threshold: parseFloat(threshold)
        }
      });

    } catch (error) {
      logger.error(`Error getting trending matches: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending matches',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/matches/stats
 * Get match statistics for user
 */
router.get('/stats',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const stats = await MatchService.getMatchStatistics(userId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error(`Error getting match statistics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get match statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/matches/manual-trigger
 * Manually trigger AI processing for an item
 */
router.post('/manual-trigger',
  auth,
  [
    body('itemId').isUUID().withMessage('Invalid item ID'),
    body('itemType').isIn(['found', 'lost']).withMessage('Invalid item type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { itemId, itemType } = req.body;
      const userId = req.user.id;

      logger.info(`User ${userId} manually triggering AI processing for ${itemType} item ${itemId}`);

      const AIService = require('../services/AIService');
      const result = await AIService.triggerManualProcessing(itemId, itemType);

      res.json({
        success: true,
        message: 'AI processing triggered successfully',
        data: result
      });

    } catch (error) {
      logger.error(`Error triggering manual AI processing: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger AI processing',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;