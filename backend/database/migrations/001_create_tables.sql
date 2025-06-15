-- File: backend/database/migrations/001_create_tables.sql
-- Database Schema untuk UNY Lost

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

-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    fullName VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    whatsappNumber VARCHAR(20) UNIQUE NOT NULL,
    isEmailVerified BOOLEAN DEFAULT FALSE,
    allowWhatsappNotifications BOOLEAN DEFAULT FALSE,
    profilePicture TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    lastLogin DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_whatsapp (whatsappNumber),
    INDEX idx_active (isActive)
);

-- Verification codes table
CREATE TABLE verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type ENUM('email', 'password_reset') NOT NULL,
    expiresAt DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    isUsed BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_identifier (identifier),
    INDEX idx_expires (expiresAt),
    INDEX idx_type (type)
);

-- Lost items table
CREATE TABLE lost_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId VARCHAR(36) NOT NULL,
    itemName VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya') NOT NULL,
    lastSeenLocation VARCHAR(255) NOT NULL,
    lastSeenDate DATE,
    contactInfo JSON,
    images JSON,
    status ENUM('active', 'has_matches', 'claimed', 'expired') DEFAULT 'active',
    isPublic BOOLEAN DEFAULT TRUE,
    aiProcessed BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (userId),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_location (lastSeenLocation),
    INDEX idx_created (createdAt),
    INDEX idx_ai_processed (aiProcessed)
);

-- Found items table
CREATE TABLE found_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    userId VARCHAR(36) NOT NULL,
    itemName VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya') NOT NULL,
    foundLocation VARCHAR(255) NOT NULL,
    foundDate DATE,
    contactInfo JSON,
    images JSON,
    status ENUM('available', 'pending_claim', 'claimed', 'returned') DEFAULT 'available',
    isPublic BOOLEAN DEFAULT TRUE,
    aiProcessed BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (userId),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_location (foundLocation),
    INDEX idx_created (createdAt),
    INDEX idx_ai_processed (aiProcessed)
);

-- Claims table
CREATE TABLE claims (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    claimerId VARCHAR(36) NOT NULL,
    itemId VARCHAR(36) NOT NULL,
    itemType ENUM('lost', 'found') NOT NULL,
    story TEXT NOT NULL,
    evidence JSON,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewedAt DATETIME,
    reviewedBy VARCHAR(36),
    rejectionReason TEXT,
    handoverDetails JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (claimerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewedBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_claimer (claimerId),
    INDEX idx_item (itemId, itemType),
    INDEX idx_status (status),
    INDEX idx_created (createdAt)
);

-- Matches table
CREATE TABLE matches (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    lostItemId VARCHAR(36) NOT NULL,
    foundItemId VARCHAR(36) NOT NULL,
    similarity FLOAT NOT NULL,
    matchType ENUM('image', 'text_clip', 'text_semantic', 'cross_modal', 'hybrid', 'strong_image', 'weak_match') NOT NULL,
    status ENUM('pending', 'claimed', 'expired') DEFAULT 'pending',
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
INSERT INTO users (fullName, email, password, whatsappNumber, isEmailVerified, allowWhatsappNotifications) VALUES
('Admin UNY Lost', 'admin@uny.ac.id', '$2a$10$example.hash.here', '+628123456789', TRUE, TRUE),
('Test User', 'test@uny.ac.id', '$2a$10$example.hash.here', '+628987654321', FALSE, FALSE);

-- Show tables and structure
SHOW TABLES;
DESCRIBE users;
DESCRIBE verification_codes;