const { sequelize, Sequelize } = require("./connection");
const { setupAssociations } = require("./associations");

setupAssociations();

module.exports = {
  sequelize,
  Sequelize,
};
