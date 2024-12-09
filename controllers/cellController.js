// controllers/cellController.js

const { Cell, Sheet, Spreadsheet } = require("../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../socket");

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
    const sheet = await Sheet.findOne({ where: { id: sheetId, spreadsheetId } });
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Prepare cells for bulkCreate with upsert
    const cellsToUpsert = cells.map(cell => ({
      sheetId,
      row: cell.row,
      column: cell.column,
      content: cell.content,
      formula: cell.formula,
      hyperlink: cell.hyperlink,
      updatedAt: new Date(),
      createdAt: new Date(),
    }));

    // Perform bulk upsert
    const upsertedCells = await Cell.bulkCreate(cellsToUpsert, {
      updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
      returning: true,
    });

    // Emit real-time updates for each cell
    const io = getIO();
    upsertedCells.forEach(cell => {
      io.to(spreadsheetId).emit("cellUpdated", { cell });
    });

    return res.status(200).json({ message: "Cells updated successfully", cells: upsertedCells });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new cell within a sheet.
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
