const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Database configuration untuk MySQL
const dbConfig = {
  development: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'uny_lost_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql', // Changed from postgres to mysql
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    // MySQL specific options
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      supportBigNumbers: true,
      bigNumberStrings: true
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  },
  test: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'uny_lost_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      supportBigNumbers: true,
      bigNumberStrings: true,
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

// Create Sequelize instance
const sequelize = new Sequelize(config);

// Test database connection
async function setupDatabase() {
  try {
    await sequelize.authenticate();
    logger.info(`✅ MySQL Database connected successfully (${env})`);
    
    if (env === 'development') {
      // Sync models in development
      await sequelize.sync({ alter: true });
      logger.info('📊 Database models synchronized');
    }
    
    return sequelize;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Database health check
async function checkDatabaseHealth() {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      connection: 'active',
      dialect: sequelize.getDialect(),
      database: config.database,
      host: config.host,
      port: config.port
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      dialect: sequelize.getDialect()
    };
  }
}

module.exports = {
  sequelize,
  setupDatabase,
  checkDatabaseHealth,
  dbConfig
};