const { Sequelize } = require("sequelize");
const config =
  require("../config/database")[process.env.NODE_ENV || "development"];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
  }
);

module.exports = {
  sequelize,
  Sequelize,
};
