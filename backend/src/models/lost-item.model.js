const { sequelize, Sequelize } = require("../database/connection");

const LostItem = sequelize.define(
  "LostItem",
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    itemName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    category: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lastSeenLocation: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    dateLost: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },
    reward: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    images: {
      type: Sequelize.JSON,
      defaultValue: [],
    },
    status: {
      type: Sequelize.ENUM("active", "has_matches", "resolved", "expired"),
      defaultValue: "active",
    },
    aiProcessed: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    lastMatchedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "lost_items",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

// Instance methods
LostItem.prototype.updateStatus = function (newStatus) {
  this.status = newStatus;
  return this.save();
};

LostItem.prototype.addImage = function (imageUrl) {
  const images = this.images || [];
  images.push(imageUrl);
  this.images = images;
  return this.save();
};

LostItem.prototype.setAIProcessed = function () {
  this.aiProcessed = true;
  return this.save();
};

LostItem.prototype.isExpired = function () {
  // Item expires after 30 days
  const createdAt = this.createdAt;
  const now = new Date();
  const diffInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  return diffInDays > 30;
};

module.exports = LostItem;
