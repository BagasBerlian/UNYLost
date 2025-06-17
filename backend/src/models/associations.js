// File: backend/src/models/associations.js
// Setup database model associations sesuai dengan class diagram

const {
  User,
  FoundItem,
  LostItem,
  Match,
  Claim,
  Notification,
} = require("./index");

/**
 * Setup Model Associations
 * Berdasarkan class diagram dan sequence diagram untuk My Items functionality
 */
const setupAssociations = () => {
  // User → Items relationships
  User.hasMany(FoundItem, {
    foreignKey: "userId",
    as: "foundItems",
    onDelete: "CASCADE",
  });

  User.hasMany(LostItem, {
    foreignKey: "userId",
    as: "lostItems",
    onDelete: "CASCADE",
  });

  // Items → User relationships (finder/owner)
  FoundItem.belongsTo(User, {
    foreignKey: "userId",
    as: "finder",
    onDelete: "CASCADE",
  });

  LostItem.belongsTo(User, {
    foreignKey: "userId",
    as: "owner",
    onDelete: "CASCADE",
  });

  // Match relationships
  Match.belongsTo(FoundItem, {
    foreignKey: "foundItemId",
    as: "foundItem",
    onDelete: "CASCADE",
  });

  Match.belongsTo(LostItem, {
    foreignKey: "lostItemId",
    as: "lostItem",
    onDelete: "CASCADE",
  });

  // Items → Matches relationships
  FoundItem.hasMany(Match, {
    foreignKey: "foundItemId",
    as: "foundMatches",
    onDelete: "CASCADE",
  });

  LostItem.hasMany(Match, {
    foreignKey: "lostItemId",
    as: "lostMatches",
    onDelete: "CASCADE",
  });

  // Claim relationships
  Claim.belongsTo(User, {
    foreignKey: "claimerId",
    as: "claimer",
    onDelete: "CASCADE",
  });

  Claim.belongsTo(FoundItem, {
    foreignKey: "foundItemId",
    as: "foundItem",
    onDelete: "CASCADE",
  });

  Claim.belongsTo(LostItem, {
    foreignKey: "lostItemId",
    as: "lostItem",
    onDelete: "CASCADE",
  });

  // User → Claims relationships
  User.hasMany(Claim, {
    foreignKey: "claimerId",
    as: "myClaims",
    onDelete: "CASCADE",
  });

  // Items → Claims relationships
  FoundItem.hasMany(Claim, {
    foreignKey: "foundItemId",
    as: "claims",
    onDelete: "CASCADE",
  });

  LostItem.hasMany(Claim, {
    foreignKey: "lostItemId",
    as: "relatedClaims",
    onDelete: "CASCADE",
  });

  // Notification relationships
  Notification.belongsTo(User, {
    foreignKey: "userId",
    as: "recipient",
    onDelete: "CASCADE",
  });

  User.hasMany(Notification, {
    foreignKey: "userId",
    as: "notifications",
    onDelete: "CASCADE",
  });

  // Optional: Match → Claim relationship (if a match results in a claim)
  Match.hasOne(Claim, {
    foreignKey: "matchId",
    as: "resultingClaim",
    onDelete: "SET NULL",
  });

  Claim.belongsTo(Match, {
    foreignKey: "matchId",
    as: "sourceMatch",
    onDelete: "SET NULL",
  });

  console.log("✅ Database model associations setup completed");
};

/**
 * Helper function to get all models with their associations
 */
const getModelsWithAssociations = () => {
  return {
    User,
    FoundItem,
    LostItem,
    Match,
    Claim,
    Notification,
  };
};

/**
 * Helper queries for My Items functionality
 */
const MyItemsQueries = {
  /**
   * Get user's found items with related data
   */
  getUserFoundItems: (userId, options = {}) => {
    return FoundItem.findAndCountAll({
      where: { userId, ...options.where },
      include: [
        {
          model: User,
          as: "finder",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "whatsappNumber",
          ],
        },
        {
          model: Match,
          as: "foundMatches",
          include: [
            {
              model: LostItem,
              as: "lostItem",
              include: [
                {
                  model: User,
                  as: "owner",
                  attributes: ["id", "firstName", "lastName", "whatsappNumber"],
                },
              ],
            },
          ],
        },
        {
          model: Claim,
          as: "claims",
          include: [
            {
              model: User,
              as: "claimer",
              attributes: ["id", "firstName", "lastName", "whatsappNumber"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      ...options,
    });
  },

  /**
   * Get user's lost items with related data
   */
  getUserLostItems: (userId, options = {}) => {
    return LostItem.findAndCountAll({
      where: { userId, ...options.where },
      include: [
        {
          model: User,
          as: "owner",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "whatsappNumber",
          ],
        },
        {
          model: Match,
          as: "lostMatches",
          include: [
            {
              model: FoundItem,
              as: "foundItem",
              include: [
                {
                  model: User,
                  as: "finder",
                  attributes: ["id", "firstName", "lastName", "whatsappNumber"],
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      ...options,
    });
  },

  /**
   * Get item with full details for owner
   */
  getItemDetailForOwner: async (itemId, itemType, userId) => {
    const Model = itemType === "found" ? FoundItem : LostItem;
    const userAs = itemType === "found" ? "finder" : "owner";
    const matchAs = itemType === "found" ? "foundMatches" : "lostMatches";
    const otherItemAs = itemType === "found" ? "lostItem" : "foundItem";
    const otherUserAs = itemType === "found" ? "owner" : "finder";

    return Model.findOne({
      where: { id: itemId, userId },
      include: [
        {
          model: User,
          as: userAs,
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "whatsappNumber",
          ],
        },
        {
          model: Match,
          as: matchAs,
          include: [
            {
              model: itemType === "found" ? LostItem : FoundItem,
              as: otherItemAs,
              include: [
                {
                  model: User,
                  as: otherUserAs,
                  attributes: ["id", "firstName", "lastName", "whatsappNumber"],
                },
              ],
            },
          ],
        },
        ...(itemType === "found"
          ? [
              {
                model: Claim,
                as: "claims",
                include: [
                  {
                    model: User,
                    as: "claimer",
                    attributes: [
                      "id",
                      "firstName",
                      "lastName",
                      "whatsappNumber",
                    ],
                  },
                  {
                    model: LostItem,
                    as: "lostItem",
                  },
                ],
              },
            ]
          : []),
      ],
    });
  },
};

module.exports = {
  setupAssociations,
  getModelsWithAssociations,
  MyItemsQueries,
};
