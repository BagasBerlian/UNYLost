const express = require('express');
const { param, query, validationResult } = require('express-validator');

const { Match, LostItem, FoundItem, User } = require('../models');
const auth = require('../middleware/auth');
const { AIService } = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   GET /api/matches
 * @desc    Get user's matches (from their lost items)
 * @access  Private
 */
router.get('/', auth, [
  query('status').optional().isIn(['pending', 'claimed', 'expired']).withMessage('Invalid status'),
  query('minSimilarity').optional().isFloat({ min: 0, max: 1 }).withMessage('Similarity must be between 0 and 1'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, minSimilarity = 0, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause for matches
    const matchWhere = {};
    if (status) matchWhere.status = status;
    if (minSimilarity > 0) {
      const { Op } = require('sequelize');
      matchWhere.similarity = { [Op.gte]: parseFloat(minSimilarity) };
    }

    // Get matches for user's lost items
    const { count, rows: matches } = await Match.findAndCountAll({
      where: matchWhere,
      include: [
        {
          model: LostItem,
          as: 'lostItem',
          where: { userId: req.userId },
          attributes: ['id', 'itemName', 'description', 'category', 'lastSeenLocation', 'status'],
          include: [{
            model: User,
            as: 'owner',
            attributes: ['id', 'fullName']
          }]
        },
        {
          model: FoundItem,
          as: 'foundItem',
          attributes: ['id', 'itemName', 'description', 'category', 'locationFound', 'images', 'status'],
          include: [{
            model: User,
            as: 'finder',
            attributes: ['id', 'fullName', 'whatsappNumber']
          }]
        }
      ],
      order: [['similarity', 'DESC'], ['detectedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Hide sensitive info for non-claimed matches
    const sanitizedMatches = matches.map(match => {
      const matchData = match.toJSON();
      
      // Hide finder's contact info until match is claimed or user contacts them
      if (match.status !== 'claimed') {
        delete matchData.foundItem.finder.whatsappNumber;
      }
      
      return matchData;
    });

    res.json({
      success: true,
      data: {
        matches: sanitizedMatches,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches',
      code: 'GET_MATCHES_ERROR'
    });
  }
});

/**
 * @route   GET /api/matches/:id
 * @desc    Get match details
 * @access  Private
 */
router.get('/:id', auth, [
  param('id').isUUID().withMessage('Invalid match ID')
], async (req, res) => {
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

    const match = await Match.findByPk(id, {
      include: [
        {
          model: LostItem,
          as: 'lostItem',
          attributes: ['id', 'itemName', 'description', 'category', 'lastSeenLocation', 'dateLost', 'reward', 'images', 'status'],
          include: [{
            model: User,
            as: 'owner',
            attributes: ['id', 'fullName', 'email', 'whatsappNumber']
          }]
        },
        {
          model: FoundItem,
          as: 'foundItem',
          attributes: ['id', 'itemName', 'description', 'category', 'locationFound', 'foundDate', 'foundTime', 'images', 'status'],
          include: [{
            model: User,
            as: 'finder',
            attributes: ['id', 'fullName', 'email', 'whatsappNumber']
          }]
        }
      ]
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
        code: 'MATCH_NOT_FOUND'
      });
    }

    // Check if user has access to this match
    const hasAccess = (
      match.lostItem.owner.id === req.userId || // Lost item owner
      match.foundItem.finder.id === req.userId   // Found item finder
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Hide sensitive info based on user role and match status
    const matchData = match.toJSON();
    
    if (match.lostItem.owner.id !== req.userId) {
      // If user is finder, hide lost item owner's contact until claimed
      if (match.status !== 'claimed') {
        delete matchData.lostItem.owner.email;
        delete matchData.lostItem.owner.whatsappNumber;
      }
    }

    if (match.foundItem.finder.id !== req.userId) {
      // If user is lost item owner, hide finder's contact until claimed
      if (match.status !== 'claimed') {
        delete matchData.foundItem.finder.email;
        delete matchData.foundItem.finder.whatsappNumber;
      }
    }

    res.json({
      success: true,
      data: { match: matchData }
    });

  } catch (error) {
    logger.error('Get match details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match details',
      code: 'GET_MATCH_ERROR'
    });
  }
});

/**
 * @route   POST /api/matches/:id/recalculate
 * @desc    Recalculate similarity for a match
 * @access  Private
 */
router.post('/:id/recalculate', auth, [
  param('id').isUUID().withMessage('Invalid match ID')
], async (req, res) => {
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

    const match = await Match.findByPk(id, {
      include: [
        {
          model: LostItem,
          as: 'lostItem',
          where: { userId: req.userId }, // Only allow recalculation for user's lost items
          attributes: ['id', 'itemName']
        },
        {
          model: FoundItem,
          as: 'foundItem',
          attributes: ['id', 'itemName']
        }
      ]
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found or access denied',
        code: 'MATCH_NOT_FOUND'
      });
    }

    // Recalculate similarity using AI service
    try {
      const similarityResult = await AIService.calculateSimilarity(
        match.lostItemId,
        match.foundItemId,
        'lost_items',
        'found_items'
      );

      // Update match with new similarity
      await match.update({
        similarity: similarityResult.similarities.hybrid,
        matchType: similarityResult.match_recommendation.best_match_type || match.matchType
      });

      logger.info(`Match similarity recalculated: ${id}, new similarity: ${similarityResult.similarities.hybrid}`);

      res.json({
        success: true,
        message: 'Similarity recalculated successfully',
        data: {
          matchId: id,
          oldSimilarity: match.similarity,
          newSimilarity: similarityResult.similarities.hybrid,
          similarityBreakdown: similarityResult.similarities,
          recommendation: similarityResult.match_recommendation
        }
      });

    } catch (aiError) {
      logger.error('AI similarity calculation error:', aiError);
      return res.status(503).json({
        success: false,
        message: 'AI service unavailable for recalculation',
        code: 'AI_SERVICE_ERROR'
      });
    }

  } catch (error) {
    logger.error('Recalculate similarity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate similarity',
      code: 'RECALCULATE_ERROR'
    });
  }
});

/**
 * @route   GET /api/matches/stats/overview
 * @desc    Get matching statistics overview
 * @access  Private
 */
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // Get user's matches statistics
    const userMatches = await Match.findAll({
      include: [{
        model: LostItem,
        as: 'lostItem',
        where: { userId: req.userId },
        attributes: []
      }],
      attributes: ['similarity', 'status', 'matchType', 'detectedAt'],
      raw: true
    });

    const stats = {
      total: userMatches.length,
      byStatus: {
        pending: userMatches.filter(m => m.status === 'pending').length,
        claimed: userMatches.filter(m => m.status === 'claimed').length,
        expired: userMatches.filter(m => m.status === 'expired').length
      },
      bySimilarity: {
        high: userMatches.filter(m => m.similarity >= 0.8).length,
        medium: userMatches.filter(m => m.similarity >= 0.6 && m.similarity < 0.8).length,
        low: userMatches.filter(m => m.similarity < 0.6).length
      },
      byMatchType: {},
      averageSimilarity: userMatches.length > 0 
        ? userMatches.reduce((sum, m) => sum + m.similarity, 0) / userMatches.length 
        : 0,
      recentMatches: userMatches.filter(m => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(m.detectedAt) > dayAgo;
      }).length
    };

    // Count by match type
    userMatches.forEach(match => {
      const type = match.matchType || 'unknown';
      stats.byMatchType[type] = (stats.byMatchType[type] || 0) + 1;
    });

    // Round average similarity
    stats.averageSimilarity = Math.round(stats.averageSimilarity * 10000) / 10000;

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get match stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get match statistics',
      code: 'GET_STATS_ERROR'
    });
  }
});

/**
 * @route   GET /api/matches/ai/status
 * @desc    Get AI matching service status
 * @access  Private
 */
router.get('/ai/status', auth, async (req, res) => {
  try {
    const aiStatus = await AIService.getHealthStatus();
    const aiStats = await AIService.getMatchingStats();

    res.json({
      success: true,
      data: {
        health: aiStatus,
        statistics: aiStats
      }
    });

  } catch (error) {
    logger.error('Get AI status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI service status',
      code: 'AI_STATUS_ERROR'
    });
  }
});

module.exports = router;