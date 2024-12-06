// tests/jest.setup.js

require('dotenv').config({ path: '.env.test' });

const { sequelize } = require("../models"); // Uncommented

module.exports = async () => {
  await sequelize.sync({ force: true });

  // Optionally, seed the database with initial data
  // For example, create a user, spreadsheet, etc.
};
