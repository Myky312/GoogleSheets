// services/formulaService.js

const mathjs = require("mathjs");
const { Cell } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

exports.evaluateFormula = async (formula, sheetId) => {
  // Extract all cell references (e.g., A1, B2)
  const cellRefs = formula.match(/[A-Z]+\d+/g) || [];

  // Parse all cell references to row and column numbers
  const references = cellRefs.map((ref) => parseCellReference(ref));

  if (references.length === 0) {
    logger.warn(`No cell references found in formula: ${formula}`);
  }

  // Batch fetch all referenced cells
  const cells = await Cell.findAll({
    where: {
      sheetId,
      [Op.or]: references.map((ref) => ({
        row: ref.row,
        column: ref.column,
      })),
    },
  });

  // Create a mapping from reference to value
  const cellMap = {};
  cells.forEach((cell) => {
    const ref = convertRowColToRef(cell.row, cell.column);
    cellMap[ref] = isNaN(parseFloat(cell.content))
      ? 0
      : parseFloat(cell.content);
  });

  // Replace cell references in the formula with actual values
  let expression = formula;
  cellRefs.forEach((ref) => {
    const value = cellMap[ref] !== undefined ? cellMap[ref] : 0;
    expression = expression.replace(new RegExp(ref, "g"), value);
  });

  // Evaluate the expression safely
  try {
    const result = mathjs.evaluate(expression);
    return result;
  } catch (error) {
    logger.error(`Error evaluating formula "${formula}": ${error.message}`);
    throw new Error("Invalid formula");
  }
};

function parseCellReference(ref) {
  const columnLetters = ref.match(/[A-Z]+/)[0];
  const rowNumber = ref.match(/\d+/)[0];

  // Convert column letters to numbers (e.g., A -> 1, B -> 2, ..., AA -> 27)
  let columnNumber = 0;
  for (let i = 0; i < columnLetters.length; i++) {
    columnNumber *= 26;
    columnNumber += columnLetters.charCodeAt(i) - 64; // A=65 in ASCII
  }

  return {
    row: parseInt(rowNumber, 10),
    column: columnNumber,
  };
}

function convertRowColToRef(row, column) {
  let ref = "";
  while (column > 0) {
    const modulo = (column - 1) % 26;
    ref = String.fromCharCode(65 + modulo) + ref;
    column = Math.floor((column - modulo) / 26);
  }
  return ref + row;
}
