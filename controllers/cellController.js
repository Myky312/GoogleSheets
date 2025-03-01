// controllers/cellController.js

const { Cell, Sheet, Spreadsheet } = require("../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../socket");
const { evaluateFormula } = require("../services/formulaService");

/**
 * Bulk create or update cells within a sheet.
 * Both owners and collaborators can perform this action.
 */
exports.bulkCreateOrUpdateCells = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { spreadsheetId, sheetId } = req.params;
    const { cells } = req.body;

    // Check if spreadsheet exists
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Check if user is authorized
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res.status(403).json({ message: "Access denied to modify cells" });
      }
    }

    // Check if sheet exists
    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Evaluate formulas before upserting
    for (const cell of cells) {
      if (cell.formula && cell.formula.startsWith("=")) {
        try {
          const expression = cell.formula.slice(1);
          const evaluatedValue = await evaluateFormula(expression, sheetId);
          cell.content = evaluatedValue.toString();
        } catch (err) {
          return res.status(400).json({
            message: `Formula evaluation error in cell (row ${cell.row}, col ${cell.column}): ${err.message}`,
          });
        }
      }
    }

    // Prepare cells for bulk upsert
    const cellsToUpsert = cells.map((cell) => ({
      sheetId,
      row: cell.row,
      column: cell.column,
      content: cell.content,
      formula: cell.formula ?? null,
      hyperlink: cell.hyperlink ?? null,
      updatedAt: new Date(),
    }));

    // Perform bulk upsert with proper conflict fields
    const upsertedCells = await Cell.bulkCreate(cellsToUpsert, {
      updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
      conflictFields: ["sheetId", "row", "column"], // Ensure this matches your unique index
      returning: true,
    });

    // Emit update event
    const io = getIO();
    io.to(spreadsheetId).emit("cellsUpdated", { cells: upsertedCells });

    return res.status(200).json({
      message: "Cells updated successfully",
      cells: upsertedCells,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update a single cell within a sheet.
 * Both owners and collaborators can create/update cells.
 */
exports.createOrUpdateCell = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { spreadsheetId, sheetId } = req.params;
    const { row, column, content, formula, hyperlink } = req.body;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    const userId = req.user.id;
    if (spreadsheet.ownerId !== userId) {
      const isCollaborator = await spreadsheet.hasCollaborator(userId);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to modify cells" });
      }
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Check if the cell already exists
    let cell = await Cell.findOne({
      where: { sheetId, row, column },
    });

    if (cell) {
      // Update existing cell
      cell.content = content;
      cell.formula = formula;
      cell.hyperlink = hyperlink;
      await cell.save();
    } else {
      // Create new cell
      cell = await Cell.create({
        sheetId,
        row,
        column,
        content,
        formula,
        hyperlink,
      });
    }

    /**
     * STEP 2: If a formula is present, evaluate it now and update 'content' to reflect
     * the computed result. We check if formula starts with '=' to distinguish it from plain text.
     */
    if (cell.formula && cell.formula.startsWith("=")) {
      try {
        const expression = cell.formula.slice(1); // remove '='
        const evaluatedValue = await evaluateFormula(expression, sheetId);
        cell.content = evaluatedValue.toString();
        await cell.save();
      } catch (err) {
        return res
          .status(400)
          .json({ message: `Formula evaluation error: ${err.message}` });
      }
    }

    // Emit event to the spreadsheet room
    const io = getIO();
    io.to(spreadsheetId).emit("cellUpdated", { cell });

    res.status(200).json({ cell });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all cells in a sheet.
 */
exports.getCells = async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId } = req.params;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    const userId = req.user.id;
    if (spreadsheet.ownerId !== userId) {
      const isCollaborator = await spreadsheet.hasCollaborator(userId);
      if (!isCollaborator) {
        return res.status(403).json({ message: "Access denied to get cells" });
      }
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Get all cells in the sheet
    const cells = await Cell.findAll({ where: { sheetId } });

    res.status(200).json({ cells });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific cell by row and column.
 */
exports.getCell = async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId, row, column } = req.params;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    const userId = req.user.id;
    if (spreadsheet.ownerId !== userId) {
      const isCollaborator = await spreadsheet.hasCollaborator(userId);
      if (!isCollaborator) {
        return res.status(403).json({ message: "Access denied to get cell" });
      }
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Fetch the cell
    const cell = await Cell.findOne({
      where: { sheetId, row, column },
    });

    if (!cell) {
      return res.status(404).json({ message: "Cell not found" });
    }

    res.status(200).json({ cell });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a cell by row and column.
 */
exports.deleteCell = async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId, row, column } = req.params;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Only owner can delete cells
    const userId = req.user.id;
    if (spreadsheet.ownerId !== userId) {
      return res.status(403).json({ message: "Only owner can delete cells" });
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Fetch the cell
    const cell = await Cell.findOne({
      where: { sheetId, row, column },
    });

    if (!cell) {
      return res.status(404).json({ message: "Cell not found" });
    }

    // Delete the cell
    await cell.destroy();

    // Emit event to the spreadsheet room
    const io = getIO();
    io.to(spreadsheetId).emit("cellDeleted", { sheetId, row, column });

    res.status(200).json({ message: "Cell deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an entire row within a sheet.
 * Only the owner can perform this action.
 */
exports.deleteRow = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { spreadsheetId, sheetId, row } = req.params;
    const userId = req.user.id;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization check
    if (spreadsheet.ownerId !== userId && !(await spreadsheet.hasCollaborator(userId))) {
      return res.status(403).json({ message: "Only owner can delete rows" });
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({ where: { id: sheetId, spreadsheetId } });
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Delete cells in the specified row
    const deletedCount = await Cell.destroy({ where: { sheetId, row } });

    // Emit Socket.IO event
    const io = getIO();
    io.to(spreadsheetId).emit("rowDeleted", { spreadsheetId, sheetId, row, deletedCount });

    return res.status(200).json({
      message: "Row deleted successfully",
      sheetId,
      row,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Delete an entire column within a sheet.
 * Only the owner can perform this action.
 */
exports.deleteColumn = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { spreadsheetId, sheetId, column } = req.params;
    const userId = req.user.id;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization check
    if (spreadsheet.ownerId !== userId && !(await spreadsheet.hasCollaborator(userId))) {
      return res.status(403).json({ message: "Only owner can delete columns" });
    }

    // Fetch the sheet
    const sheet = await Sheet.findOne({ where: { id: sheetId, spreadsheetId } });
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Delete cells in the specified column
    const deletedCount = await Cell.destroy({ where: { sheetId, column } });

    // Emit Socket.IO event
    const io = getIO();
    io.to(spreadsheetId).emit("columnDeleted", { spreadsheetId, sheetId, column, deletedCount });

    // Respond to client
    return res.status(200).json({
      message: "Column deleted successfully",
      sheetId,
      column,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

