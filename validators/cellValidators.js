// validators/cellValidators.js

const { body, param } = require("express-validator");

exports.bulkUpdateCellsValidator = [
  // Validate 'spreadsheetId' in the URL parameters
  param("spreadsheetId")
    .isUUID()
    .withMessage("Invalid spreadsheet ID format"),

  // Validate 'sheetId' in the URL parameters
  param("sheetId")
    .isUUID()
    .withMessage("Invalid sheet ID format"),

  // Validate that 'cells' is a non-empty array
  body("cells")
    .isArray({ min: 1 })
    .withMessage("Cells should be a non-empty array"),

  // Validate each cell object in the 'cells' array
  body("cells.*.row")
    .isInt({ min: 1 })
    .withMessage("Row must be a positive integer"),

  body("cells.*.column")
    .isInt({ min: 1 })
    .withMessage("Column must be a positive integer"),

  body("cells.*.content")
    .optional()
    .isString()
    .withMessage("Content must be a string"),

  body("cells.*.formula")
    .optional()
    .isString()
    .withMessage("Formula must be a string"),

  body("cells.*.hyperlink")
    .optional()
    .isURL()
    .withMessage("Hyperlink must be a valid URL"),
];
