// routes/formulaRoutes.js

const express = require("express");
const { body } = require("express-validator");
const { evaluateFormulaEndpoint } = require("../controllers/formulaController");

const router = express.Router();

router.post(
  "/evaluate",
  [
    body("spreadsheetId")
      .notEmpty()
      .withMessage("spreadsheetId is required")
      .isInt()
      .withMessage("spreadsheetId must be numeric"),
    body("sheetId")
      .notEmpty()
      .withMessage("sheetId is required")
      .isInt()
      .withMessage("sheetId must be numeric"),
    body("formula")
      .notEmpty()
      .withMessage("formula is required")
      .isString()
      .withMessage("formula must be a string"),
  ],
  evaluateFormulaEndpoint
);

module.exports = router;
