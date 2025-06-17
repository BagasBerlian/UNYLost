// File: backend/src/routes/items.js - Routes untuk Found & Lost Items
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const ItemService = require('../services/ItemService');
const GoogleDriveService = require('../services/GoogleDriveService');
const AIService = require('../services/AIService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Max 5 files
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
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10-500 characters'),
  body('category')
    .isIn(['Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya'])
    .withMessage('Invalid category'),
  body('locationFound')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Location must be between 5-200 characters'),
  body('foundDate')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('foundTime')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('Invalid time format (HH:MM:SS)')
];

const lostItemValidation = [
  body('itemName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Item name must be between 2-100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10-500 characters'),
  body('category')
    .isIn(['Dompet/Tas', 'Elektronik', 'Kartu Identitas', 'Kunci', 'Buku/ATK', 'Aksesoris', 'Pakaian', 'Lainnya'])
    .withMessage('Invalid category'),
  body('lastSeenLocation')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Last seen location must be between 5-200 characters'),
  body('dateLost')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('reward')
    .optional()
    .isNumeric()
    .withMessage('Reward must be a number')
    .custom(value => {
      if (value < 0 || value > 500000) {
        throw new Error('Reward must be between 0-500000');
      }
      return true;
    })
];

/**
 * POST /api/items/found
 * Create new found item report
 */
router.post('/found', 
  auth,
  upload.array('images', 5),
  foundItemValidation,
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      // Check if at least one image is uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image is required for found items'
        });
      }

      const { itemName, description, category, locationFound, foundDate, foundTime } = req.body;
      const userId = req.user.id;

      logger.info(`Creating found item report for user ${userId}: ${itemName}`);

      // Upload images to Google Drive
      const imageUrls = [];
      for (const file of req.files) {
        try {
          const imageUrl = await GoogleDriveService.uploadImage(file, 'found_items');
          imageUrls.push(imageUrl);
          logger.info(`Image uploaded successfully: ${imageUrl}`);
        } catch (uploadError) {
          logger.error(`Failed to upload image: ${uploadError.message}`);
          // Continue with other images instead of failing completely
        }
      }

      if (imageUrls.length === 0) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images. Please try again.'
        });
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
  }
);

/**
 * POST /api/items/lost
 * Create new lost item report
 */
router.post('/lost',
  auth,
  upload.array('images', 5),
  lostItemValidation,
  async (req, res) => {
    try {
      // Validate request
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

      logger.info(`Creating lost item report for user ${userId}: ${itemName}`);

      // Upload images to Google Drive (optional for lost items)
      const imageUrls = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const imageUrl = await GoogleDriveService.uploadImage(file, 'lost_items');
            imageUrls.push(imageUrl);
            logger.info(`Image uploaded successfully: ${imageUrl}`);
          } catch (uploadError) {
            logger.error(`Failed to upload image: ${uploadError.message}`);
            // Continue with other images
          }
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
  }
);

/**
 * GET /api/items/my-items
 * Get user's found and lost items
 */
router.get('/my-items',
  auth,
  [
    query('type').optional().isIn(['found', 'lost', 'all']).withMessage('Invalid type'),
    query('status').optional().isIn(['active', 'available', 'pending_claim', 'claimed', 'resolved', 'expired']).withMessage('Invalid status'),
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
      const { type = 'all', status, page = 1, limit = 10 } = req.query;

      logger.info(`Getting items for user ${userId}, type: ${type}, status: ${status}`);

      const result = await ItemService.getUserItems(userId, {
        type,
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error(`Error getting user items: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get items',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/items/:id
 * Get specific item details
 */
router.get('/:id',
  auth,
  [
    param('id').isUUID().withMessage('Invalid item ID'),
    query('type').isIn(['found', 'lost']).withMessage('Type is required (found/lost)')
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
      const { type } = req.query;
      const userId = req.user.id;

      const item = await ItemService.getItemById(id, type, userId);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      res.json({
        success: true,
        data: item
      });

    } catch (error) {
      logger.error(`Error getting item: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get item',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * PUT /api/items/:id/status
 * Update item status
 */
router.put('/:id/status',
  auth,
  [
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
  }
);

/**
 * DELETE /api/items/:id
 * Delete item (soft delete)
 */
router.delete('/:id',
  auth,
  [
    param('id').isUUID().withMessage('Invalid item ID'),
    query('type').isIn(['found', 'lost']).withMessage('Type is required (found/lost)')
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
  }
);

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB per file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files.'
      });
    }
  }

  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (JPG, PNG, etc.) are allowed.'
    });
  }

  logger.error(`Items route error: ${error.message}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;