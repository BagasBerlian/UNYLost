const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { LostItem, FoundItem, User, Match } = require('../models');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { AIService } = require('../services/aiService');
const { FileService } = require('../services/fileService');
const { NotificationService } = require('../services/notificationService');

const router = express.Router();

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation rules
const foundItemValidation = [
  body('itemName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Item name must be between 2-100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10-2000 characters'),
  body('category')
    .isIn(['Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya'])
    .withMessage('Invalid category'),
  body('locationFound')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2-100 characters'),
  body('foundDate')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('foundTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time format (HH:MM) is required')
];

const lostItemValidation = [
  body('itemName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Item name must be between 2-100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10-2000 characters'),
  body('category')
    .isIn(['Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya'])
    .withMessage('Invalid category'),
  body('lastSeenLocation')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2-100 characters'),
  body('dateLost')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('reward')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Reward must be a positive number')
];

/**
 * @route   POST /api/items/found
 * @desc    Report found item
 * @access  Private
 */
router.post('/found', auth, upload.array('images', 5), foundItemValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if images are provided (required for found items)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required for found items',
        code: 'NO_IMAGES'
      });
    }

    const { itemName, description, category, locationFound, foundDate, foundTime } = req.body;

    // Upload images to Google Drive
    const imageUrls = [];
    for (const file of req.files) {
      try {
        const imageUrl = await FileService.uploadImage(file, 'found');
        imageUrls.push(imageUrl);
      } catch (uploadError) {
        logger.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images',
          code: 'IMAGE_UPLOAD_ERROR'
        });
      }
    }

    // Create found item
    const foundItem = await FoundItem.create({
      itemName: itemName.trim(),
      description: description.trim(),
      category,
      locationFound: locationFound.trim(),
      foundDate,
      foundTime,
      images: imageUrls,
      userId: req.userId,
      status: 'available'
    });

    // Process with AI for instant matching
    try {
      const aiResponse = await AIService.processFoundItem({
        item_id: foundItem.id,
        item_name: foundItem.itemName,
        description: foundItem.description,
        category: foundItem.category,
        image_url: imageUrls[0], // Use first image for processing
        collection: 'found_items',
        threshold: 0.75
      });

      // Update AI processed status
      await foundItem.update({ aiProcessed: true });

      // Process matches if found
      if (aiResponse.matches && aiResponse.matches.length > 0) {
        await processAIMatches(foundItem, aiResponse.matches);
      }

      logger.info(`Found item processed: ${foundItem.id}, ${aiResponse.matches.length} matches found`);

    } catch (aiError) {
      logger.error('AI processing error for found item:', aiError);
      // Continue without AI processing - item is still created
    }

    // Get created item with user info
    const createdItem = await FoundItem.findByPk(foundItem.id, {
      include: [{
        model: User,
        as: 'finder',
        attributes: ['id', 'fullName', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Found item reported successfully',
      data: {
        item: createdItem
      }
    });

  } catch (error) {
    logger.error('Create found item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report found item',
      code: 'CREATE_FOUND_ITEM_ERROR'
    });
  }
});

/**
 * @route   POST /api/items/lost
 * @desc    Report lost item
 * @access  Private
 */
router.post('/lost', auth, upload.array('images', 3), lostItemValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { itemName, description, category, lastSeenLocation, dateLost, reward = 0 } = req.body;

    // Upload images if provided (optional for lost items)
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const imageUrl = await FileService.uploadImage(file, 'lost');
          imageUrls.push(imageUrl);
        } catch (uploadError) {
          logger.error('Image upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload images',
            code: 'IMAGE_UPLOAD_ERROR'
          });
        }
      }
    }

    // Create lost item
    const lostItem = await LostItem.create({
      itemName: itemName.trim(),
      description: description.trim(),
      category,
      lastSeenLocation: lastSeenLocation.trim(),
      dateLost,
      reward: parseFloat(reward),
      images: imageUrls,
      userId: req.userId,
      status: 'active'
    });

    // Process with AI if we have image or sufficient description
    if (imageUrls.length > 0 || description.length > 50) {
      try {
        const aiResponse = await AIService.processLostItem({
          item_id: lostItem.id,
          item_name: lostItem.itemName,
          description: lostItem.description,
          category: lostItem.category,
          image_url: imageUrls[0] || null,
          collection: 'lost_items',
          threshold: 0.75
        });

        // Update AI processed status
        await lostItem.update({ aiProcessed: true });

        logger.info(`Lost item processed: ${lostItem.id}, AI embeddings generated`);

      } catch (aiError) {
        logger.error('AI processing error for lost item:', aiError);
        // Continue without AI processing
      }
    }

    // Get created item with user info
    const createdItem = await LostItem.findByPk(lostItem.id, {
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Lost item reported successfully',
      data: {
        item: createdItem
      }
    });

  } catch (error) {
    logger.error('Create lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report lost item',
      code: 'CREATE_LOST_ITEM_ERROR'
    });
  }
});

/**
 * @route   GET /api/items/my
 * @desc    Get user's items (lost and found)
 * @access  Private
 */
router.get('/my', auth, [
  query('type').optional().isIn(['lost', 'found', 'all']).withMessage('Invalid type'),
  query('status').optional().withMessage('Invalid status'),
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

    const { type = 'all', status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = {
      lostItems: [],
      foundItems: [],
      pagination: {}
    };

    // Get lost items
    if (type === 'all' || type === 'lost') {
      const lostWhere = { userId: req.userId };
      if (status) lostWhere.status = status;

      const { count: lostCount, rows: lostItems } = await LostItem.findAndCountAll({
        where: lostWhere,
        include: [{
          model: Match,
          as: 'matches',
          include: [{
            model: FoundItem,
            as: 'foundItem',
            attributes: ['id', 'itemName', 'locationFound', 'status']
          }]
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      result.lostItems = lostItems;
      result.pagination.lost = {
        total: lostCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(lostCount / limit)
      };
    }

    // Get found items
    if (type === 'all' || type === 'found') {
      const foundWhere = { userId: req.userId };
      if (status) foundWhere.status = status;

      const { count: foundCount, rows: foundItems } = await FoundItem.findAndCountAll({
        where: foundWhere,
        include: [{
          model: Match,
          as: 'matches',
          include: [{
            model: LostItem,
            as: 'lostItem',
            attributes: ['id', 'itemName', 'lastSeenLocation', 'status']
          }]
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      result.foundItems = foundItems;
      result.pagination.found = {
        total: foundCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(foundCount / limit)
      };
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get my items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch items',
      code: 'GET_MY_ITEMS_ERROR'
    });
  }
});

/**
 * @route   GET /api/items/lost/:id/matches
 * @desc    Get matches for a lost item
 * @access  Private
 */
router.get('/lost/:id/matches', auth, [
  param('id').isUUID().withMessage('Invalid item ID'),
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

    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Verify ownership
    const lostItem = await LostItem.findOne({
      where: { id, userId: req.userId }
    });

    if (!lostItem) {
      return res.status(404).json({
        success: false,
        message: 'Lost item not found or access denied',
        code: 'ITEM_NOT_FOUND'
      });
    }

    // Get matches
    const { count, rows: matches } = await Match.findAndCountAll({
      where: { lostItemId: id },
      include: [{
        model: FoundItem,
        as: 'foundItem',
        include: [{
          model: User,
          as: 'finder',
          attributes: ['id', 'fullName']
        }]
      }],
      order: [['similarity', 'DESC'], ['detectedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        matches,
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
 * @route   GET /api/items/:type/:id
 * @desc    Get item details
 * @access  Private
 */
router.get('/:type/:id', auth, [
  param('type').isIn(['lost', 'found']).withMessage('Invalid item type'),
  param('id').isUUID().withMessage('Invalid item ID')
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

    const { type, id } = req.params;
    const Model = type === 'lost' ? LostItem : FoundItem;
    const userAs = type === 'lost' ? 'owner' : 'finder';

    const item = await Model.findByPk(id, {
      include: [{
        model: User,
        as: userAs,
        attributes: ['id', 'fullName', 'email', 'whatsappNumber']
      }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} item not found`,
        code: 'ITEM_NOT_FOUND'
      });
    }

    // Hide sensitive info if not owner
    if (item.userId !== req.userId) {
      item[userAs].whatsappNumber = undefined;
      item[userAs].email = undefined;
    }

    res.json({
      success: true,
      data: { item }
    });

  } catch (error) {
    logger.error('Get item details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item details',
      code: 'GET_ITEM_ERROR'
    });
  }
});

/**
 * @route   PUT /api/items/:type/:id/status
 * @desc    Update item status
 * @access  Private
 */
router.put('/:type/:id/status', auth, [
  param('type').isIn(['lost', 'found']).withMessage('Invalid item type'),
  param('id').isUUID().withMessage('Invalid item ID'),
  body('status').notEmpty().withMessage('Status is required')
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

    const { type, id } = req.params;
    const { status } = req.body;
    const Model = type === 'lost' ? LostItem : FoundItem;

    // Validate status values
    const validStatuses = {
      lost: ['active', 'has_matches', 'resolved', 'expired'],
      found: ['available', 'pending_claim', 'claimed', 'expired']
    };

    if (!validStatuses[type].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status for ${type} item`,
        code: 'INVALID_STATUS'
      });
    }

    // Find and verify ownership
    const item = await Model.findOne({
      where: { id, userId: req.userId }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} item not found or access denied`,
        code: 'ITEM_NOT_FOUND'
      });
    }

    // Update status
    await item.update({ status });

    logger.info(`${type} item status updated: ${id} -> ${status}`);

    res.json({
      success: true,
      message: 'Item status updated successfully',
      data: { item }
    });

  } catch (error) {
    logger.error('Update item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item status',
      code: 'UPDATE_STATUS_ERROR'
    });
  }
});

/**
 * @route   DELETE /api/items/:type/:id
 * @desc    Delete item (soft delete by setting status to expired)
 * @access  Private
 */
router.delete('/:type/:id', auth, [
  param('type').isIn(['lost', 'found']).withMessage('Invalid item type'),
  param('id').isUUID().withMessage('Invalid item ID')
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

    const { type, id } = req.params;
    const Model = type === 'lost' ? LostItem : FoundItem;

    // Find and verify ownership
    const item = await Model.findOne({
      where: { id, userId: req.userId }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} item not found or access denied`,
        code: 'ITEM_NOT_FOUND'
      });
    }

    // Soft delete by setting status to expired
    await item.update({ status: 'expired' });

    logger.info(`${type} item deleted: ${id}`);

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    logger.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item',
      code: 'DELETE_ITEM_ERROR'
    });
  }
});

// Helper function to process AI matches
async function processAIMatches(foundItem, matches) {
  try {
    for (const match of matches) {
      // Check if match already exists
      const existingMatch = await Match.findOne({
        where: {
          lostItemId: match.item_id,
          foundItemId: foundItem.id
        }
      });

      if (!existingMatch) {
        // Create new match
        const newMatch = await Match.create({
          lostItemId: match.item_id,
          foundItemId: foundItem.id,
          similarity: match.similarity_score,
          matchType: match.match_type || 'hybrid',
          status: 'pending',
          detectedAt: new Date()
        });

        // Send notification to lost item owner
        const lostItem = await LostItem.findByPk(match.item_id, {
          include: [{
            model: User,
            as: 'owner',
            attributes: ['id', 'whatsappNumber', 'notificationSettings']
          }]
        });

        if (lostItem && lostItem.owner) {
          await NotificationService.sendMatchFoundNotification(
            lostItem.owner,
            foundItem,
            newMatch
          );
        }

        // Update lost item status
        await lostItem.update({ status: 'has_matches', lastMatchedAt: new Date() });

        logger.info(`Match created: ${newMatch.id} (${match.similarity_score * 100}% similarity)`);
      }
    }
  } catch (error) {
    logger.error('Process AI matches error:', error);
  }
}

module.exports = router;