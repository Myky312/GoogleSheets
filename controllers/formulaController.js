// controllers/formulaController.js

const { validationResult } = require("express-validator");
const { evaluateFormula } = require("../services/formulaService");
const { Spreadsheet } = require("../models");

/**
 * Evaluates a spreadsheet formula and returns the computed result.
 * This endpoint is optional if you only want to evaluate formulas
 * during cell creation/update. But if you need a standalone
 * formula-evaluation endpoint, here's how to do it.
 */
exports.evaluateFormulaEndpoint = async (req, res, next) => {
  try {
    // 1. Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { spreadsheetId, sheetId, formula } = req.body;

    // 2. Verify the spreadsheet exists and user has access.
    //    (Similar to your cellController logic.)
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // If you need to ensure only collaborators or owner can evaluate formulas:
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to evaluate formula" });
      }
    }

    // 3. Strip out the leading '=' if present
    let expression = formula.startsWith("=") ? formula.slice(1) : formula;

    // 4. Evaluate using your formulaService
    //    Note that the second argument is `sheetId` from the request, used
    //    by formulaService to look up referenced cells.
    const result = await evaluateFormula(expression, sheetId);

    // 5. Return the result
    return res.status(200).json({ result });
  } catch (error) {
    // Let your global error handler or Express error middleware handle this
    next(error);
  }
};
