// routes/sheetRoutes.js

const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator"); // Ensure param is imported
const sheetController = require("../controllers/sheetController");
const authorizeSpreadsheetAccess = require("../middleware/authorizeSpreadsheetAccess");
const logger = require("../utils/logger");

// Middleware to handle validation results
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation errors:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

