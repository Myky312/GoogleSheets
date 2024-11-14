// jest.config.js

const path = require("path");

module.exports = {
  testEnvironment: "node",
  // setupFiles: [path.resolve(__dirname, "./jest.setup.js")],
  
};
// tests/jest.config.js

module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  setupFilesAfterEnv: [path.resolve(__dirname, "./jest.setup.js")],
  // setupFiles: ['<rootDir>/tests/jest.setup.js'], // If you have setup files
  maxWorkers: 1, // Run tests sequentially
  testTimeout: 10000, // Optional: Increase timeout if necessary
};
