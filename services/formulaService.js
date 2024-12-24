// services/formulaService.js

const { create, all } = require("mathjs");
const { Cell } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Create a mathjs instance with all functions
const math = create(all);

// **Updated Regular Expression for Numeric-Only Cell References**
const cellRefRegex = /\b\d+,\d+\b/g;

/**
 * Evaluates a spreadsheet formula.
 * @param {string} formula - The formula to evaluate.
 * @param {string} sheetId - The ID of the sheet.
 * @param {Set} visitedCells - Set of visited cells to detect circular references.
 * @returns {Promise<number>} - The result of the formula evaluation.
 */
exports.evaluateFormula = async (
  formula,
  sheetId,
  visitedCells = new Set()
) => {
  // Extract all cell references
  const cellRefs = extractCellReferences(formula);

  // Fetch cell values
  const cellValues = await fetchCellValues(cellRefs, sheetId, visitedCells);

  // Replace cell references with actual values
  const expression = replaceCellReferences(formula, cellValues);

  // Evaluate the expression safely
  try {
    const result = math.evaluate(expression);
    return result;
  } catch (error) {
    logger.error(`Error evaluating formula "${formula}": ${error.message}`);
    throw new Error(`Error in formula: ${error.message}`);
  }
};

/**
 * Extracts cell references from a formula.
 * @param {string} formula - The formula string.
 * @returns {Array<string>} - Array of cell references.
 */
function extractCellReferences(formula) {
  const refs = formula.match(cellRefRegex) || [];
  return refs;
}

/**
 * Fetches cell values for given references.
 * @param {Array<string>} cellRefs - Array of cell references.
 * @param {string} sheetId - The ID of the sheet.
 * @param {Set} visitedCells - Set of visited cells for circular reference detection.
 * @returns {Promise<Object>} - Mapping from cell reference to value.
 */
async function fetchCellValues(cellRefs, sheetId, visitedCells) {
  // Parse references to row and column
  const references = cellRefs.map((ref) => parseCellReference(ref));

  // Detect circular references
  references.forEach((ref) => {
    const cellKey = `${sheetId}_${ref.row}_${ref.column}`;
    if (visitedCells.has(cellKey)) {
      throw new Error("Circular reference detected");
    }
    visitedCells.add(cellKey);
  });

  // Fetch cells from the database
  const cells = await Cell.findAll({
    where: {
      sheetId,
      [Op.or]: references.map((ref) => ({
        row: ref.row,
        column: ref.column,
      })),
    },
  });

  // Create a mapping from cell reference to value
  const cellMap = {};
  for (const ref of references) {
    const cellKey = convertRowColToRef(ref.row, ref.column);
    const cell = cells.find(
      (c) => c.row === ref.row && c.column === ref.column
    );

    let value = 0; // Default value if cell not found
    if (cell) {
      if (cell.formula && cell.formula.startsWith("=")) {
        // Evaluate nested formula
        value = await exports.evaluateFormula(
          cell.formula.slice(1),
          sheetId,
          visitedCells
        );
      } else {
        value = parseFloat(cell.content);
        if (isNaN(value)) {
          value = 0;
        }
      }
    }
    cellMap[cellKey] = value;
  }

  // Clean up visited cells
  references.forEach((ref) => {
    const cellKey = `${sheetId}_${ref.row}_${ref.column}`;
    visitedCells.delete(cellKey);
  });

  return cellMap;
}

/**
 * Replaces cell references in a formula with actual values.
 * @param {string} formula - The original formula.
 * @param {Object} cellValues - Mapping from cell references to values.
 * @returns {string} - The formula with cell references replaced by values.
 */
function replaceCellReferences(formula, cellValues) {
  return formula.replace(cellRefRegex, (match) => {
    const value = cellValues[match] !== undefined ? cellValues[match] : 0;
    return value;
  });
}

/**
 * **Updated** Parses a cell reference into row and column numbers.
 * @param {string} ref - The cell reference (e.g., "1,1").
 * @returns {Object} - An object with 'row' and 'column' numbers.
 */
function parseCellReference(ref) {
  const [row, column] = ref.split(",").map(Number);

  if (isNaN(row) || isNaN(column)) {
    throw new Error(`Invalid cell reference format: "${ref}"`);
  }

  return {
    row,
    column,
  };
}

/**
 * **Updated** Converts row and column numbers back to a cell reference.
 * @param {number} row - The row number.
 * @param {number} column - The column number.
 * @returns {string} - The cell reference (e.g., "1,1").
 */
function convertRowColToRef(row, column) {
  return `${row},${column}`;
}
