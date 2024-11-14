// config/config.js

require("dotenv").config();
const env = process.env.NODE_ENV || "development";
const config = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    logging: console.log,
  },
  test: {
    url:
      process.env.TEST_DATABASE_URL ||
      "postgres://sheetuser:5675@localhost:5432/spreadsheetdb_test",
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
  },
};

// Enhanced Logging
// console.log("====================================");
// console.log(`Running in '${env}' environment`);
// console.log(`Using DATABASE_URL: ${config[env].url}`);
// console.log("====================================");

module.exports = config;
