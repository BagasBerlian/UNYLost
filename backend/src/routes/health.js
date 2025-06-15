const express = require('express');
const { checkDatabaseHealth } = require('../config/database');
const { AIService } = require('../services/aiService');
const { WhatsAppService } = require('../services/whatsappService');
const { FileService } = require('../services/fileService');
const { getStats } = require('../services/cronService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Comprehensive health check
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check all services
    const [
      databaseHealth,
      aiHealth,
      whatsappHealth,
      fileHealth,
      cronStats
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      AIService.getHealthStatus(),
      Promise.resolve(WhatsAppService.getStats()),
      Promise.resolve(FileService.getStatus()),
      getStats()
    ]);

    const responseTime = Date.now() - startTime;

    // Determine overall health
    let overallStatus = 'healthy';
    let issues = [];

    // Check database
    if (databaseHealth.status === 'rejected' || databaseHealth.value?.status === 'unhealthy') {
      overallStatus = 'unhealthy';
      issues.push('Database connection failed');
    }

    // Check AI service
    if (aiHealth.status === 'rejected' || aiHealth.value?.status !== 'healthy') {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('AI service unavailable');
    }

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      issues: issues.length > 0 ? issues : undefined,
      services: {
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { status: 'error', error: databaseHealth.reason?.message },
        ai: aiHealth.status === 'fulfilled' ? aiHealth.value : { status: 'error', error: aiHealth.reason?.message },
        whatsapp: whatsappHealth.status === 'fulfilled' ? whatsappHealth.value : { status: 'error' },
        files: fileHealth.status === 'fulfilled' ? fileHealth.value : { status: 'error' },
        cron: cronStats.status === 'fulfilled' ? cronStats.value.jobs : { status: 'error' }
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        cpu: process.cpuUsage()
      }
    };

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;
    
    res.status(statusCode).json({
      success: overallStatus !== 'unhealthy',
      data: healthData
    });

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/health/database
 * @desc    Database health check
 * @access  Public
 */
router.get('/database', async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });

  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/health/ai
 * @desc    AI service health check
 * @access  Public
 */
router.get('/ai', async (req, res) => {
  try {
    const health = await AIService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });

  } catch (error) {
    logger.error('AI health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/health/stats
 * @desc    System statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

/**
 * @route   POST /api/health/trigger-matching
 * @desc    Manually trigger background matching
 * @access  Private (Admin only in production)
 */
router.post('/trigger-matching', async (req, res) => {
  try {
    const { triggerBackgroundMatching } = require('../services/cronService');
    const result = await triggerBackgroundMatching();
    
    res.json({
      success: true,
      message: 'Background matching triggered successfully',
      data: result
    });

  } catch (error) {
    logger.error('Trigger matching error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger background matching'
    });
  }
});

module.exports = router;