const { sequelize, Sequelize } = require("../database/connection");

const Match = sequelize.define(
  "Match",
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    lostItemId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "lost_items",
        key: "id",
      },
    },
    foundItemId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "found_items",
        key: "id",
      },
    },
    similarity: {
      type: Sequelize.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 1,
      },
    },
    matchType: {
      type: Sequelize.ENUM("image", "text", "hybrid"),
      defaultValue: "hybrid",
    },
    status: {
      type: Sequelize.ENUM("pending", "claimed", "expired"),
      defaultValue: "pending",
    },
    detectedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    matchingVersion: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "matches",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

// Instance methods
Match.prototype.isHighSimilarity = function () {
  return this.similarity >= 0.85;
};

Match.prototype.expire = function () {
  this.status = "expired";
  return this.save();
};

Match.prototype.claim = function () {
  this.status = "claimed";
  return this.save();
};

Match.prototype.getPercentage = function () {
  return Math.round(this.similarity * 100);
};

module.exports = Match;
