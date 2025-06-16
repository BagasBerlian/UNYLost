-- File: backend/database/migrations/001_create_tables.sql
-- Database Schema untuk UNY Lost - FIXED VERSION

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS uny_lost_db;
USE uny_lost_db;

-- Drop existing tables (for clean migration)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS verification_codes;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS found_items;
DROP TABLE IF EXISTS lost_items;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- Users table - SESUAI DENGAN SEQUENCE DIAGRAM
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    whatsappNumber VARCHAR(20) UNIQUE NOT NULL,
    isWhatsappVerified BOOLEAN DEFAULT FALSE,
    agreeNotification BOOLEAN DEFAULT FALSE,
    verificationCode VARCHAR(10),
    verified BOOLEAN DEFAULT FALSE,
    verifiedAt DATETIME NULL,
    profilePicture TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    lastLogin DATETIME,
    lastLogout DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_whatsapp (whatsappNumber),
    INDEX idx_active (isActive),
    INDEX idx_verified (verified)
);

-- Verification codes table - EXTENDED FOR BETTER SECURITY
CREATE TABLE verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- email or phone
    code VARCHAR(10) NOT NULL,
    type ENUM('email', 'whatsapp', 'password_reset') NOT NULL,
    expiresAt DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    isUsed BOOLEAN DEFAULT FALSE,
    userId VARCHAR(36),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_identifier (identifier),
    INDEX idx_expires (expiresAt),
    INDEX idx_type (type),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Lost items table
CREATE TABLE lost_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId VARCHAR(36) NOT NULL,
    itemName VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('electronics', 'documents', 'clothing', 'accessories', 'books', 'keys', 'others') NOT NULL,
    lastSeenLocation VARCHAR(255) NOT NULL,
    dateLost DATE NOT NULL,
    reward DECIMAL(10,2) DEFAULT 0,
    images JSON,
    status ENUM('active', 'has_matches', 'resolved', 'expired') DEFAULT 'active',
    aiProcessed BOOLEAN DEFAULT FALSE,
    lastMatchedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (userId),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_location (lastSeenLocation),
    INDEX idx_date_lost (dateLost),
    INDEX idx_ai_processed (aiProcessed)
);

-- Found items table
CREATE TABLE found_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId VARCHAR(36) NOT NULL,
    itemName VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('electronics', 'documents', 'clothing', 'accessories', 'books', 'keys', 'others') NOT NULL,
    locationFound VARCHAR(255) NOT NULL,
    foundDate DATE NOT NULL,
    foundTime TIME NOT NULL,
    images JSON,
    status ENUM('available', 'pending_claim', 'claimed', 'expired') DEFAULT 'available',
    aiProcessed BOOLEAN DEFAULT FALSE,
    lastMatchedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (userId),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_location (locationFound),
    INDEX idx_date_found (foundDate),
    INDEX idx_ai_processed (aiProcessed)
);

-- Claims table
CREATE TABLE claims (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    claimerId VARCHAR(36) NOT NULL,
    foundItemId VARCHAR(36) NOT NULL,
    lostItemId VARCHAR(36),
    story TEXT NOT NULL,
    evidenceImages JSON,
    status ENUM('pending', 'approved', 'rejected', 'withdrawn') DEFAULT 'pending',
    reviewedBy VARCHAR(36),
    reviewedAt DATETIME,
    rejectionReason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (claimerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (foundItemId) REFERENCES found_items(id) ON DELETE CASCADE,
    FOREIGN KEY (lostItemId) REFERENCES lost_items(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewedBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_claimer (claimerId),
    INDEX idx_found_item (foundItemId),
    INDEX idx_lost_item (lostItemId),
    INDEX idx_status (status),
    INDEX idx_created (createdAt)
);

-- Matches table
CREATE TABLE matches (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    lostItemId VARCHAR(36) NOT NULL,
    foundItemId VARCHAR(36) NOT NULL,
    similarity DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    matchType ENUM('image', 'text', 'hybrid') NOT NULL,
    status ENUM('new', 'viewed', 'contacted', 'resolved', 'expired') DEFAULT 'new',
    aiMetadata JSON,
    detectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    notificationSent BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lostItemId) REFERENCES lost_items(id) ON DELETE CASCADE,
    FOREIGN KEY (foundItemId) REFERENCES found_items(id) ON DELETE CASCADE,
    INDEX idx_lost_item (lostItemId),
    INDEX idx_found_item (foundItemId),
    INDEX idx_similarity (similarity),
    INDEX idx_status (status),
    INDEX idx_detected (detectedAt),
    INDEX idx_notification (notificationSent),
    UNIQUE KEY unique_match (lostItemId, foundItemId)
);

-- Notifications table
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId VARCHAR(36) NOT NULL,
    type ENUM('match_found', 'claim_received', 'claim_approved', 'claim_rejected', 'system_update') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    isRead BOOLEAN DEFAULT FALSE,
    sentAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (userId),
    INDEX idx_type (type),
    INDEX idx_read (isRead),
    INDEX idx_created (createdAt)
);

-- Insert sample data for testing
INSERT INTO users (firstName, lastName, email, passwordHash, whatsappNumber, verified, agreeNotification) VALUES
('Admin', 'UNY Lost', 'admin@uny.ac.id', '$2a$10$kZe5g1xS8mNH3m9zP2b4ZuJ9v8K7L6Q5w4E3r2T1y0u9I8o7P6', '+628123456789', TRUE, TRUE),
('Test', 'User', 'test@uny.ac.id', '$2a$10$kZe5g1xS8mNH3m9zP2b4ZuJ9v8K7L6Q5w4E3r2T1y0u9I8o7P6', '+628987654321', FALSE, FALSE);

-- Show tables and structure
SHOW TABLES;
DESCRIBE users;
DESCRIBE verification_codes;