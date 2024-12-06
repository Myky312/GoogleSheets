// tests/jest.config.js

const path = require("path");

module.exports = {
  testEnvironment: "node",
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/tests/**/*.test.js"],
  coverageDirectory: "./coverage/",
  collectCoverage: true,
  setupFilesAfterEnv: [path.resolve(__dirname, "./jest.setup.js")],
  maxWorkers: 1, // Run tests sequentially
  testTimeout: 10000, // Optional: Increase timeout if necessary
};
