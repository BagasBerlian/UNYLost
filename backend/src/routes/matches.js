// File: backend/src/routes/matches.js
// API Routes untuk Matches dan Claims Management

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/matches/lost-item/:id
 * Get matches untuk specific lost item
 */
router.get('/lost-item/:id', auth, [
  param('id').isUUID().withMessage('Invalid lost item ID'),
  query('threshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Threshold must be between 0-1')
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

    const { id: lostItemId } = req.params;
    const { threshold = 0.6 } = req.query;
    const userId = req.user.id;

    // Verify user owns this lost item
    const [ownerCheck] = await db.execute(
      'SELECT id FROM lost_items WHERE id = ? AND userId = ?',
      [lostItemId, userId]
    );

    if (ownerCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lost item not found or unauthorized'
      });
    }

    // Get matches untuk lost item ini
    const [matchRows] = await db.execute(`
      SELECT 
        m.*,
        fi.itemName as foundItemName,
        fi.description as foundDescription,
        fi.category as foundCategory,
        fi.locationFound,
        fi.foundDate,
        fi.foundTime,
        fi.images as foundImages,
        fi.status as foundStatus,
        u.firstName as finderFirstName,
        u.lastName as finderLastName,
        u.whatsappNumber as finderPhone,
        u.email as finderEmail
      FROM matches m
      JOIN found_items fi ON m.foundItemId = fi.id
      JOIN users u ON fi.userId = u.id
      WHERE m.lostItemId = ? 
      AND m.similarity >= ?
      AND fi.status IN ('available', 'pending_claim')
      ORDER BY m.similarity DESC, m.detectedAt DESC
    `, [lostItemId, threshold]);

    // Parse images dan format data
    const matches = matchRows.map(match => ({
      id: match.id,
      foundItemId: match.foundItemId,
      similarity: parseFloat(match.similarity),
      matchType: match.matchType,
      status: match.status,
      detectedAt: match.detectedAt,
      foundItem: {
        id: match.foundItemId,
        itemName: match.foundItemName,
        description: match.foundDescription,
        category: match.foundCategory,
        locationFound: match.locationFound,
        foundDate: match.foundDate,
        foundTime: match.foundTime,
        images: match.foundImages ? JSON.parse(match.foundImages) : [],
        status: match.foundStatus,
        finder: {
          name: `${match.finderFirstName} ${match.finderLastName}`,
          phone: match.finderPhone,
          email: match.finderEmail
        }
      },
      confidence: getConfidenceLevel(parseFloat(match.similarity))
    }));

    logger.info(`Found ${matches.length} matches for lost item ${lostItemId}`);

    res.json({
      success: true,
      data: matches,
      totalMatches: matches.length,
      threshold: parseFloat(threshold)
    });

  } catch (error) {
    logger.error(`Error getting matches for lost item: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get matches',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/matches/found-item/:id  
 * Get matches untuk specific found item
 */
router.get('/found-item/:id', auth, [
  param('id').isUUID().withMessage('Invalid found item ID'),
  query('threshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Threshold must be between 0-1')
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

    const { id: foundItemId } = req.params;
    const { threshold = 0.6 } = req.query;
    const userId = req.user.id;

    // Verify user owns this found item
    const [ownerCheck] = await db.execute(
      'SELECT id FROM found_items WHERE id = ? AND userId = ?',
      [foundItemId, userId]
    );

    if (ownerCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Found item not found or unauthorized'
      });
    }

    // Get matches untuk found item ini
    const [matchRows] = await db.execute(`
      SELECT 
        m.*,
        li.itemName as lostItemName,
        li.description as lostDescription,
        li.category as lostCategory,
        li.lastSeenLocation,
        li.dateLost,
        li.reward,
        li.images as lostImages,
        li.status as lostStatus,
        u.firstName as ownerFirstName,
        u.lastName as ownerLastName,
        u.whatsappNumber as ownerPhone,
        u.email as ownerEmail
      FROM matches m
      JOIN lost_items li ON m.lostItemId = li.id
      JOIN users u ON li.userId = u.id
      WHERE m.foundItemId = ? 
      AND m.similarity >= ?
      AND li.status IN ('active', 'has_matches')
      ORDER BY m.similarity DESC, m.detectedAt DESC
    `, [foundItemId, threshold]);

    // Parse images dan format data
    const matches = matchRows.map(match => ({
      id: match.id,
      lostItemId: match.lostItemId,
      similarity: parseFloat(match.similarity),
      matchType: match.matchType,
      status: match.status,
      detectedAt: match.detectedAt,
      lostItem: {
        id: match.lostItemId,
        itemName: match.lostItemName,
        description: match.lostDescription,
        category: match.lostCategory,
        lastSeenLocation: match.lastSeenLocation,
        dateLost: match.dateLost,
        reward: match.reward,
        images: match.lostImages ? JSON.parse(match.lostImages) : [],
        status: match.lostStatus,
        owner: {
          name: `${match.ownerFirstName} ${match.ownerLastName}`,
          phone: match.ownerPhone,
          email: match.ownerEmail
        }
      },
      confidence: getConfidenceLevel(parseFloat(match.similarity))
    }));

    logger.info(`Found ${matches.length} matches for found item ${foundItemId}`);

    res.json({
      success: true,
      data: matches,
      totalMatches: matches.length,
      threshold: parseFloat(threshold)
    });

  } catch (error) {
    logger.error(`Error getting matches for found item: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get matches',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/matches/:id/status
 * Update match status (viewed, contacted, etc.)
 */
router.put('/:id/status', auth, [
  param('id').isUUID().withMessage('Invalid match ID'),
  body('status').isIn(['new', 'viewed', 'contacted', 'resolved', 'expired']).withMessage('Invalid status')
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

    const { id: matchId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Verify user has access to this match
    const [matchCheck] = await db.execute(`
      SELECT m.id 
      FROM matches m
      JOIN lost_items li ON m.lostItemId = li.id
      JOIN found_items fi ON m.foundItemId = fi.id
      WHERE m.id = ? AND (li.userId = ? OR fi.userId = ?)
    `, [matchId, userId, userId]);

    if (matchCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Match not found or unauthorized'
      });
    }

    // Update match status
    await db.execute(
      'UPDATE matches SET status = ? WHERE id = ?',
      [status, matchId]
    );

    logger.info(`Match ${matchId} status updated to ${status} by user ${userId}`);

    res.json({
      success: true,
      message: 'Match status updated successfully'
    });

  } catch (error) {
    logger.error(`Error updating match status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update match status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/matches/stats
 * Get matching statistics untuk user
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get statistics
    const [statsRows] = await db.execute(`
      SELECT 
        -- Found items stats
        (SELECT COUNT(*) FROM found_items WHERE userId = ?) as totalFoundItems,
        (SELECT COUNT(*) FROM found_items fi 
         JOIN matches m ON fi.id = m.foundItemId 
         WHERE fi.userId = ? AND m.similarity >= 0.75) as foundWithMatches,
        
        -- Lost items stats  
        (SELECT COUNT(*) FROM lost_items WHERE userId = ?) as totalLostItems,
        (SELECT COUNT(*) FROM lost_items li
         JOIN matches m ON li.id = m.lostItemId
         WHERE li.userId = ? AND m.similarity >= 0.75) as lostWithMatches,
         
        -- Claims stats
        (SELECT COUNT(*) FROM claims WHERE claimerId = ?) as totalClaims,
        (SELECT COUNT(*) FROM claims WHERE claimerId = ? AND status = 'approved') as approvedClaims,
        
        -- Received claims stats
        (SELECT COUNT(*) FROM claims c
         JOIN found_items fi ON c.foundItemId = fi.id
         WHERE fi.userId = ?) as receivedClaims,
        (SELECT COUNT(*) FROM claims c
         JOIN found_items fi ON c.foundItemId = fi.id
         WHERE fi.userId = ? AND c.status = 'pending') as pendingClaims
    `, [userId, userId, userId, userId, userId, userId, userId, userId]);

    const stats = statsRows[0];

    res.json({
      success: true,
      data: {
        foundItems: {
          total: stats.totalFoundItems,
          withMatches: stats.foundWithMatches,
          matchRate: stats.totalFoundItems > 0 ? 
            ((stats.foundWithMatches / stats.totalFoundItems) * 100).toFixed(1) : 0
        },
        lostItems: {
          total: stats.totalLostItems,
          withMatches: stats.lostWithMatches,
          matchRate: stats.totalLostItems > 0 ? 
            ((stats.lostWithMatches / stats.totalLostItems) * 100).toFixed(1) : 0
        },
        claims: {
          submitted: stats.totalClaims,
          approved: stats.approvedClaims,
          successRate: stats.totalClaims > 0 ? 
            ((stats.approvedClaims / stats.totalClaims) * 100).toFixed(1) : 0
        },
        receivedClaims: {
          total: stats.receivedClaims,
          pending: stats.pendingClaims
        }
      }
    });

  } catch (error) {
    logger.error(`Error getting match stats: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/matches/manual
 * Create manual match (admin feature)
 */
router.post('/manual', auth, [
  body('lostItemId').isUUID().withMessage('Invalid lost item ID'),
  body('foundItemId').isUUID().withMessage('Invalid found item ID'),
  body('similarity').isFloat({ min: 0, max: 1 }).withMessage('Similarity must be between 0-1'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason too long')
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

    const { lostItemId, foundItemId, similarity, reason } = req.body;
    const userId = req.user.id;

    // Check if items exist
    const [itemCheck] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM lost_items WHERE id = ?) as lostExists,
        (SELECT COUNT(*) FROM found_items WHERE id = ?) as foundExists
    `, [lostItemId, foundItemId]);

    if (itemCheck[0].lostExists === 0 || itemCheck[0].foundExists === 0) {
      return res.status(404).json({
        success: false,
        message: 'One or both items not found'
      });
    }

    // Check if match already exists
    const [existingMatch] = await db.execute(
      'SELECT id FROM matches WHERE lostItemId = ? AND foundItemId = ?',
      [lostItemId, foundItemId]
    );

    if (existingMatch.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Match already exists'
      });
    }

    // Create manual match
    const [result] = await db.execute(`
      INSERT INTO matches (
        id, lostItemId, foundItemId, similarity, matchType, status, 
        aiMetadata, detectedAt, createdAt
      ) VALUES (UUID(), ?, ?, ?, 'manual', 'new', ?, NOW(), NOW())
    `, [lostItemId, foundItemId, similarity, JSON.stringify({ reason, createdBy: userId })]);

    logger.info(`Manual match created between lost ${lostItemId} and found ${foundItemId}`);

    res.status(201).json({
      success: true,
      message: 'Manual match created successfully',
      data: {
        lostItemId,
        foundItemId,
        similarity,
        type: 'manual'
      }
    });

  } catch (error) {
    logger.error(`Error creating manual match: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create manual match',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function untuk confidence level
function getConfidenceLevel(similarity) {
  if (similarity >= 0.9) return 'Very High';
  if (similarity >= 0.8) return 'High';
  if (similarity >= 0.7) return 'Medium';
  if (similarity >= 0.6) return 'Low';
  return 'Very Low';
}

module.exports = router;