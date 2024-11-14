// // jest.setup.js

// const dotenv = require("dotenv");
// const { sequelize } = require("../models"); // Adjust the path if necessary

// // Load environment variables based on NODE_ENV
// const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
// const result = dotenv.config({ path: envFile });

// if (result.error) {
//   throw result.error;
// }

// // Increase Jest's default timeout for long-running tests
// jest.setTimeout(10000); // 10 seconds

// // Global setup: Drop and sync database
// beforeAll(async () => {
//   try {
//     await sequelize.drop(); // Drops all tables
//     await sequelize.sync({ force: true }); // Recreates tables based on models
//   } catch (error) {
//     console.error("Error setting up test database:", error);
//     throw error;
//   }
// });

// // Global teardown: Close Sequelize connection
// afterAll(async () => {
//   await sequelize.close();
// });
// tests/jest.setup.js

require('dotenv').config({ path: '.env.test' });
