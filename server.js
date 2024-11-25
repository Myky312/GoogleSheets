// server.js

require("dotenv").config();
const http = require("http");
const logger = require("./utils/logger");
const { sequelize } = require("./models");
const app = require("./app");
const { initializeSocket } = require("./socket"); // Import initializeSocket

const PORT = process.env.PORT || 3000;

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io using socket.js
initializeSocket(server);

// Start the Server
server.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  try {
    await sequelize.authenticate();
    logger.info("Database connected!");
  } catch (error) {
    logger.error("Unable to connect to the database:", error);
    process.exit(1); // Exit process if DB connection fails
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Promise Rejection:", error);
  shutdown();
});

// Graceful Shutdown
const shutdown = () => {
  logger.info("Shutting down server...");
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await sequelize.close();
      logger.info("Database connection closed.");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
