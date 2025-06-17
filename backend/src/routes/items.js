// File: backend/src/routes/items.js
// API Routes untuk Items - UPDATED for My Items functionality

const express = require('express');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const ItemService = require('../services/ItemService');
const GoogleDriveService = require('../services/GoogleDriveService');
const AIService = require('../services/AIService');
const logger = require('../utils/logger');
const db = require('../config/database');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * GET /api/items/my-items  
 * Get user items berdasarkan JWT token - IMPROVED VERSION
 */
router.get('/my-items', async (req, res) => {
  try {
    // Extract token dari header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uny_lost_secret_key_2024');
    
    // Get user dari database berdasarkan decoded token
    const [userRows] = await db.execute(
      'SELECT id, firstName, lastName, email FROM users WHERE id = ? AND isActive = 1',
      [decoded.userId]
    );

    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userRows[0];
    const { type = 'all' } = req.query;

    console.log(`📱 Getting items for user: ${user.email}, type: ${type}`);

    let responseData = [];

    // Query found items dengan matches dan claims count
    if (type === 'found' || type === 'all') {
      const [foundRows] = await db.execute(`
        SELECT 
          fi.*,
          COALESCE((
            SELECT COUNT(*) 
            FROM matches m 
            WHERE m.foundItemId = fi.id 
            AND m.status IN ('new', 'viewed')
          ), 0) as matchCount,
          COALESCE((
            SELECT COUNT(*) 
            FROM claims c 
            WHERE c.foundItemId = fi.id 
            AND c.status = 'pending'
          ), 0) as claimCount
        FROM found_items fi
        WHERE fi.userId = ? 
        ORDER BY fi.createdAt DESC
      `, [user.id]);

      const foundItems = foundRows.map(item => ({
        ...item,
        images: item.images ? JSON.parse(item.images) : [],
        timeAgo: getTimeAgo(item.createdAt),
        type: 'found'
      }));

      if (type === 'found') {
        responseData = foundItems;
      } else {
        responseData = [...responseData, ...foundItems];
      }
    }

    // Query lost items dengan matches count
    if (type === 'lost' || type === 'all') {
      const [lostRows] = await db.execute(`
        SELECT 
          li.*,
          COALESCE((
            SELECT COUNT(*) 
            FROM matches m 
            WHERE m.lostItemId = li.id 
            AND m.status IN ('new', 'viewed') 
            AND m.similarity >= 0.75
          ), 0) as matchCount
        FROM lost_items li
        WHERE li.userId = ?
        ORDER BY li.createdAt DESC
      `, [user.id]);

      const lostItems = lostRows.map(item => ({
        ...item,
        images: item.images ? JSON.parse(item.images) : [],
        timeAgo: getTimeAgo(item.createdAt),
        type: 'lost'
      }));

      if (type === 'lost') {
        responseData = lostItems;
      } else {
        responseData = [...responseData, ...lostItems];
      }
    }

    // Query approved claims
    if (type === 'claims') {
      const [claimRows] = await db.execute(`
        SELECT 
          c.*,
          fi.itemName,
          fi.images,
          fi.locationFound,
          u.firstName as finderFirstName,
          u.lastName as finderLastName,
          u.whatsappNumber as finderPhone
        FROM claims c
        JOIN found_items fi ON c.foundItemId = fi.id
        JOIN users u ON fi.userId = u.id
        WHERE c.claimerId = ? 
        ORDER BY c.createdAt DESC
      `, [user.id]);

      responseData = claimRows.map(claim => ({
        ...claim,
        images: claim.images ? JSON.parse(claim.images) : [],
        timeAgo: getTimeAgo(claim.createdAt),
        type: 'claims',
        finderName: `${claim.finderFirstName} ${claim.finderLastName}`
      }));
    }

    console.log(`✅ Found ${responseData.length} items for user ${user.email}`);

    res.json({
      success: true,
      message: 'Items retrieved successfully',
      data: responseData,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      }
    });

  } catch (error) {
    console.error('❌ Error getting user items:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get items',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/items/:id/detail
 * Get item detail dengan matches/claims info
 */
router.get('/:id/detail', auth, [
  param('id').isUUID().withMessage('Invalid item ID'),
  query('type').isIn(['found', 'lost']).withMessage('Type is required (found/lost)')
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
    const { type } = req.query;
    const userId = req.user.id;

    let itemData = null;

    if (type === 'found') {
      // Get found item dengan matches dan claims
      const [itemRows] = await db.execute(`
        SELECT fi.*, u.firstName, u.lastName, u.whatsappNumber
        FROM found_items fi
        JOIN users u ON fi.userId = u.id
        WHERE fi.id = ?
      `, [id]);

      if (itemRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Found item not found'
        });
      }

      itemData = itemRows[0];

      // Get matches untuk found item ini
      const [matchRows] = await db.execute(`
        SELECT 
          m.*,
          li.itemName as lostItemName,
          li.description as lostDescription,
          li.lastSeenLocation,
          li.dateLost,
          li.reward,
          li.images as lostImages,
          u.firstName as ownerFirstName,
          u.lastName as ownerLastName,
          u.whatsappNumber as ownerPhone
        FROM matches m
        JOIN lost_items li ON m.lostItemId = li.id
        JOIN users u ON li.userId = u.id
        WHERE m.foundItemId = ? AND m.similarity >= 0.6
        ORDER BY m.similarity DESC, m.detectedAt DESC
      `, [id]);

      // Get claims untuk found item ini
      const [claimRows] = await db.execute(`
        SELECT 
          c.*,
          u.firstName as claimerFirstName,
          u.lastName as claimerLastName,
          u.whatsappNumber as claimerPhone,
          li.itemName as lostItemName
        FROM claims c
        JOIN users u ON c.claimerId = u.id
        LEFT JOIN lost_items li ON c.lostItemId = li.id
        WHERE c.foundItemId = ?
        ORDER BY c.createdAt DESC
      `, [id]);

      itemData.matches = matchRows;
      itemData.claims = claimRows;

    } else if (type === 'lost') {
      // Get lost item dengan matches
      const [itemRows] = await db.execute(`
        SELECT li.*, u.firstName, u.lastName, u.whatsappNumber
        FROM lost_items li
        JOIN users u ON li.userId = u.id
        WHERE li.id = ?
      `, [id]);

      if (itemRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Lost item not found'
        });
      }

      itemData = itemRows[0];

      // Get matches untuk lost item ini
      const [matchRows] = await db.execute(`
        SELECT 
          m.*,
          fi.itemName as foundItemName,
          fi.description as foundDescription,
          fi.locationFound,
          fi.foundDate,
          fi.images as foundImages,
          u.firstName as finderFirstName,
          u.lastName as finderLastName,
          u.whatsappNumber as finderPhone
        FROM matches m
        JOIN found_items fi ON m.foundItemId = fi.id
        JOIN users u ON fi.userId = u.id
        WHERE m.lostItemId = ? AND m.similarity >= 0.6
        ORDER BY m.similarity DESC, m.detectedAt DESC
      `, [id]);

      itemData.matches = matchRows;
    }

    // Parse images
    if (itemData.images) {
      itemData.images = JSON.parse(itemData.images);
    }

    // Parse images di matches
    if (itemData.matches) {
      itemData.matches = itemData.matches.map(match => ({
        ...match,
        foundImages: match.foundImages ? JSON.parse(match.foundImages) : [],
        lostImages: match.lostImages ? JSON.parse(match.lostImages) : []
      }));
    }

    res.json({
      success: true,
      data: itemData
    });

  } catch (error) {
    logger.error(`Error getting item detail: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get item detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/items/found
 * Create found item report
 */
router.post('/found', auth, upload.array('images', 5), [
  body('itemName').trim().isLength({ min: 3, max: 100 }).withMessage('Item name must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').isIn(['electronics', 'documents', 'clothing', 'accessories', 'books', 'keys', 'others']).withMessage('Invalid category'),
  body('locationFound').trim().isLength({ min: 3, max: 200 }).withMessage('Location must be 3-200 characters'),
  body('foundDate').isDate().withMessage('Invalid found date'),
  body('foundTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)')
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

    const { itemName, description, category, locationFound, foundDate, foundTime } = req.body;
    const userId = req.user.id;
    const files = req.files || [];

    // Upload images to Google Drive
    const imageUrls = [];
    for (const file of files) {
      try {
        const imageUrl = await GoogleDriveService.uploadFile(
          file.buffer,
          `found_${Date.now()}_${file.originalname}`,
          file.mimetype
        );
        imageUrls.push(imageUrl);
        logger.info(`Image uploaded successfully: ${imageUrl}`);
      } catch (uploadError) {
        logger.error(`Failed to upload image: ${uploadError.message}`);
        // Continue with other images
      }
    }

    // Create found item in database
    const foundItemData = {
      itemName: itemName.trim(),
      description: description.trim(),
      category,
      locationFound: locationFound.trim(),
      foundDate,
      foundTime,
      images: imageUrls,
      userId,
      status: 'available'
    };

    const foundItem = await ItemService.createFoundItem(foundItemData);
    logger.info(`Found item created with ID: ${foundItem.id}`);

    // Trigger AI matching in background
    try {
      const aiResponse = await AIService.processFoundItem(foundItem);
      logger.info(`AI processing initiated for found item ${foundItem.id}`);
      
      // Update matches count if available
      if (aiResponse.matchesCount) {
        foundItem.matchesCount = aiResponse.matchesCount;
      }
    } catch (aiError) {
      logger.warn(`AI processing failed for found item ${foundItem.id}: ${aiError.message}`);
      // Don't fail the entire request if AI processing fails
    }

    res.status(201).json({
      success: true,
      message: 'Found item report created successfully',
      data: {
        id: foundItem.id,
        itemName: foundItem.itemName,
        category: foundItem.category,
        locationFound: foundItem.locationFound,
        foundDate: foundItem.foundDate,
        matchesCount: foundItem.matchesCount || 0,
        status: foundItem.status,
        createdAt: foundItem.createdAt
      }
    });

  } catch (error) {
    logger.error(`Error creating found item: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create found item report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/items/lost
 * Create lost item report
 */
router.post('/lost', auth, upload.array('images', 5), [
  body('itemName').trim().isLength({ min: 3, max: 100 }).withMessage('Item name must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').isIn(['electronics', 'documents', 'clothing', 'accessories', 'books', 'keys', 'others']).withMessage('Invalid category'),
  body('lastSeenLocation').trim().isLength({ min: 3, max: 200 }).withMessage('Location must be 3-200 characters'),
  body('dateLost').isDate().withMessage('Invalid lost date'),
  body('reward').optional().isNumeric().withMessage('Reward must be a number')
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

    const { itemName, description, category, lastSeenLocation, dateLost, reward = 0 } = req.body;
    const userId = req.user.id;
    const files = req.files || [];

    // Upload images to Google Drive
    const imageUrls = [];
    for (const file of files) {
      try {
        const imageUrl = await GoogleDriveService.uploadFile(
          file.buffer,
          `lost_${Date.now()}_${file.originalname}`,
          file.mimetype
        );
        imageUrls.push(imageUrl);
        logger.info(`Image uploaded successfully: ${imageUrl}`);
      } catch (uploadError) {
        logger.error(`Failed to upload image: ${uploadError.message}`);
        // Continue with other images
      }
    }

    // Create lost item in database
    const lostItemData = {
      itemName: itemName.trim(),
      description: description.trim(),
      category,
      lastSeenLocation: lastSeenLocation.trim(),
      dateLost,
      reward: parseFloat(reward),
      images: imageUrls,
      userId,
      status: 'active'
    };

    const lostItem = await ItemService.createLostItem(lostItemData);
    logger.info(`Lost item created with ID: ${lostItem.id}`);

    // Trigger AI matching in background
    try {
      const aiResponse = await AIService.processLostItem(lostItem);
      logger.info(`AI processing initiated for lost item ${lostItem.id}`);
      
      // Update matches count if available
      if (aiResponse.matchesCount) {
        lostItem.matchesCount = aiResponse.matchesCount;
      }
    } catch (aiError) {
      logger.warn(`AI processing failed for lost item ${lostItem.id}: ${aiError.message}`);
      // Don't fail the entire request if AI processing fails
    }

    res.status(201).json({
      success: true,
      message: 'Lost item report created successfully',
      data: {
        id: lostItem.id,
        itemName: lostItem.itemName,
        category: lostItem.category,
        lastSeenLocation: lostItem.lastSeenLocation,
        dateLost: lostItem.dateLost,
        reward: lostItem.reward,
        matchesCount: lostItem.matchesCount || 0,
        status: lostItem.status,
        createdAt: lostItem.createdAt
      }
    });

  } catch (error) {
    logger.error(`Error creating lost item: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create lost item report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/items/:id/status
 * Update item status
 */
router.put('/:id/status', auth, [
  param('id').isUUID().withMessage('Invalid item ID'),
  body('type').isIn(['found', 'lost']).withMessage('Type is required (found/lost)'),
  body('status').custom((value, { req }) => {
    const validStatuses = {
      found: ['available', 'pending_claim', 'claimed', 'expired'],
      lost: ['active', 'has_matches', 'resolved', 'expired']
    };
    
    if (!validStatuses[req.body.type].includes(value)) {
      throw new Error(`Invalid status for ${req.body.type} item`);
    }
    return true;
  })
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
    const { type, status } = req.body;
    const userId = req.user.id;

    const updated = await ItemService.updateItemStatus(id, type, status, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Item not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Item status updated successfully'
    });

  } catch (error) {
    logger.error(`Error updating item status: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update item status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/items/:id
 * Delete item (soft delete)
 */
router.delete('/:id', auth, [
  param('id').isUUID().withMessage('Invalid item ID'),
  query('type').isIn(['found', 'lost']).withMessage('Type is required (found/lost)')
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
    const { type } = req.query;
    const userId = req.user.id;

    const deleted = await ItemService.deleteItem(id, type, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Item not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    logger.error(`Error deleting item: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function untuk time ago
function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  
  if (diffDays < 1) return 'Hari ini';
  if (diffDays === 1) return '1 hari yang lalu';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffWeeks === 1) return '1 minggu yang lalu';
  return `${diffWeeks} minggu yang lalu`;
}

module.exports = router;