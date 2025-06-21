const { sequelize, Sequelize } = require("../database/connection");

const FoundItem = sequelize.define(
  "FoundItem",
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
    locationFound: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    foundDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },
    foundTime: {
      type: Sequelize.TIME,
      allowNull: true,
    },
    images: {
      type: Sequelize.JSON,
      defaultValue: [],
    },
    status: {
      type: Sequelize.ENUM("available", "pending_claim", "claimed", "expired"),
      defaultValue: "available",
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
    tableName: "found_items",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

// Instance methods
FoundItem.prototype.updateStatus = function (newStatus) {
  this.status = newStatus;
  return this.save();
};

FoundItem.prototype.addImage = function (imageUrl) {
  const images = this.images || [];
  images.push(imageUrl);
  this.images = images;
  return this.save();
};

FoundItem.prototype.setAIProcessed = function () {
  this.aiProcessed = true;
  return this.save();
};

FoundItem.prototype.isExpired = function () {
  // Item expires after 60 days
  const createdAt = this.createdAt;
  const now = new Date();
  const diffInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  return diffInDays > 60;
};

module.exports = FoundItem;
