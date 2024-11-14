// middleware/errorHandler.js

const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, ...err });

  const statusCode = err.status || 500;
  const message =
    statusCode === 500
      ? "Internal Server Error"
      : err.message || "An error occurred";

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

module.exports = errorHandler;
