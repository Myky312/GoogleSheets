// routes/formulaRoutes.js

const express = require("express");
const { body } = require("express-validator");
const formulaController = require("../controllers/formulaController");
const router = express.Router();

// Optional: If you’re using authentication middleware, ensure it runs before the route
// e.g. router.use(authMiddleware);

// Define a POST endpoint to evaluate a formula
router.post(
  "/evaluate",
  [
    body("spreadsheetId").isNumeric().withMessage("spreadsheetId must be numeric"),
    body("sheetId").isNumeric().withMessage("sheetId must be numeric"),
    body("formula").isString().withMessage("formula must be a string"),
  ],
  formulaController.evaluateFormulaEndpoint
);

module.exports = router;
