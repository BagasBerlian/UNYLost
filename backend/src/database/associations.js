const User = require("../models/user.model");
const LostItem = require("../models/lost-item.model");
const FoundItem = require("../models/found-item.model");
const Match = require("../models/match.model");

function setupAssociations() {
  User.hasMany(LostItem, { foreignKey: "userId" });
  LostItem.belongsTo(User, { foreignKey: "userId" });

  User.hasMany(FoundItem, { foreignKey: "userId" });
  FoundItem.belongsTo(User, { foreignKey: "userId" });

  LostItem.hasMany(Match, { foreignKey: "lostItemId" });
  Match.belongsTo(LostItem, { foreignKey: "lostItemId" });

  FoundItem.hasMany(Match, { foreignKey: "foundItemId" });
  Match.belongsTo(FoundItem, { foreignKey: "foundItemId" });
}

module.exports = {
  setupAssociations,
};
