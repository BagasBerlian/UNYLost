// File: backend/src/config/database.js
// Enhanced database configuration dan setup untuk My Items

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uny_lost_db',
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: false,
    paranoid: false,
    freezeTableName: true
  },
  timezone: '+07:00' // WIB timezone
};

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to database:', error.message);
    return false;
  }
};

/**
 * Create database if not exists
 */
const createDatabaseIfNotExists = async () => {
  try {
    // Connect without specifying database
    const tempSequelize = new Sequelize(
      '', // No database specified
      dbConfig.username,
      dbConfig.password,
      {
        ...dbConfig,
        database: undefined
      }
    );

    // Create database
    await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    logger.info(`✅ Database '${dbConfig.database}' created or already exists`);
    
    await tempSequelize.close();
    return true;
  } catch (error) {
    logger.error('❌ Error creating database:', error.message);
    return false;
  }
};

/**
 * Run database migrations
 */
const runMigrations = async () => {
  try {
    const migrationsPath = path.join(__dirname, '../database/migrations');
    
    if (!fs.existsSync(migrationsPath)) {
      logger.warn('⚠️  Migrations directory not found');
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsPath, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL file by statements (rough implementation)
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          await sequelize.query(statement);
        }
      }
      
      logger.info(`✅ Migration executed: ${file}`);
    }

    return true;
  } catch (error) {
    logger.error('❌ Error running migrations:', error.message);
    return false;
  }
};

/**
 * Sync database models
 */
const syncModels = async (force = false) => {
  try {
    // Import models to register them
    require('../models');
    
    // Setup associations
    const { setupAssociations } = require('../models/associations');
    setupAssociations();

    // Sync all models
    await sequelize.sync({ 
      force: force, // WARNING: force = true will drop tables
      alter: process.env.NODE_ENV === 'development' // Alter tables in development
    });

    logger.info('✅ Database models synchronized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error syncing models:', error.message);
    return false;
  }
};

/**
 * Seed initial data
 */
const seedInitialData = async () => {
  try {
    const { User } = require('../models');
    
    // Check if admin user exists
    const adminUser = await User.findOne({
      where: { email: 'admin@uny.ac.id' }
    });

    if (!adminUser) {
      // Create admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await User.create({
        firstName: 'Admin',
        lastName: 'UNY Lost',
        email: 'admin@uny.ac.id',
        passwordHash: hashedPassword,
        whatsappNumber: '+628123456789',
        isWhatsappVerified: true,
        verified: true,
        verifiedAt: new Date(),
        isActive: true
      });

      logger.info('✅ Admin user created');
    }

    // Add more seed data as needed
    logger.info('✅ Initial data seeded successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error seeding initial data:', error.message);
    return false;
  }
};

/**
 * Initialize database
 */
const initializeDatabase = async (options = {}) => {
  const { 
    createDb = true, 
    runMigrations: shouldRunMigrations = true, 
    syncModels: shouldSyncModels = true,
    seedData = true,
    force = false 
  } = options;

  try {
    logger.info('🚀 Initializing database...');

    // Step 1: Create database if needed
    if (createDb) {
      const dbCreated = await createDatabaseIfNotExists();
      if (!dbCreated) {
        throw new Error('Failed to create database');
      }
    }

    // Step 2: Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Step 3: Run migrations
    if (shouldRunMigrations) {
      const migrated = await runMigrations();
      if (!migrated) {
        logger.warn('⚠️  Migrations failed, continuing with model sync');
      }
    }

    // Step 4: Sync models
    if (shouldSyncModels) {
      const synced = await syncModels(force);
      if (!synced) {
        throw new Error('Failed to sync models');
      }
    }

    // Step 5: Seed initial data
    if (seedData) {
      const seeded = await seedInitialData();
      if (!seeded) {
        logger.warn('⚠️  Seeding failed, but database is ready');
      }
    }

    logger.info('🎉 Database initialization completed successfully');
    return true;

  } catch (error) {
    logger.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

/**
 * Close database connection
 */
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('✅ Database connection closed');
  } catch (error) {
    logger.error('❌ Error closing database connection:', error.message);
  }
};

/**
 * Health check for database
 */
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT 1 as status');
    
    return {
      status: 'healthy',
      connection: 'active',
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connection: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get database statistics
 */
const getStats = async () => {
  try {
    const { User, FoundItem, LostItem, Match, Claim } = require('../models');
    
    const [
      totalUsers,
      totalFoundItems,
      totalLostItems,
      totalMatches,
      totalClaims,
      activeUsers,
      activeFoundItems,
      activeLostItems
    ] = await Promise.all([
      User.count(),
      FoundItem.count(),
      LostItem.count(),
      Match.count(),
      Claim.count(),
      User.count({ where: { isActive: true } }),
      FoundItem.count({ where: { status: 'available' } }),
      LostItem.count({ where: { status: 'active' } })
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers
      },
      items: {
        found: {
          total: totalFoundItems,
          active: activeFoundItems
        },
        lost: {
          total: totalLostItems,
          active: activeLostItems
        }
      },
      matches: totalMatches,
      claims: totalClaims,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting database stats:', error.message);
    throw error;
  }
};

/**
 * Backup database (MySQL dump)
 */
const createBackup = async (backupPath) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `uny_lost_backup_${timestamp}.sql`;
    const fullPath = path.join(backupPath || './backups', filename);
    
    // Ensure backup directory exists
    const backupDir = path.dirname(fullPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create mysqldump command
    const command = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.username} ${dbConfig.password ? `-p${dbConfig.password}` : ''} ${dbConfig.database} > ${fullPath}`;
    
    await execAsync(command);
    
    logger.info(`✅ Database backup created: ${fullPath}`);
    return {
      success: true,
      filename,
      path: fullPath,
      size: fs.statSync(fullPath).size
    };
  } catch (error) {
    logger.error('❌ Error creating backup:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sequelize,
  dbConfig,
  testConnection,
  createDatabaseIfNotExists,
  runMigrations,
  syncModels,
  seedInitialData,
  initializeDatabase,
  closeConnection,
  healthCheck,
  getStats,
  createBackup
};