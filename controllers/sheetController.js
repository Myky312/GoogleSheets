// controllers/sheetController.js

const { Sheet, Spreadsheet } = require("../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../socket");

/**
 * Create a new sheet within a spreadsheet.
 * Both owners and collaborators can create sheets.
 */
exports.createSheet = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    const spreadsheetId = req.params.spreadsheetId;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to create sheet" });
      }
    }

    // Create the sheet
    const sheet = await Sheet.create({ spreadsheetId, name });

    // Emit event to the spreadsheet room
    const io = getIO();
    io.to(spreadsheetId).emit("sheetCreated", { sheet });

    res.status(201).json({ sheet });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all sheets within a spreadsheet.
 * Both owners and collaborators can retrieve sheets.
 */
exports.getSheets = async (req, res, next) => {
  try {
    const spreadsheetId = req.params.spreadsheetId;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to retrieve sheets" });
      }
    }

    const sheets = await Sheet.findAll({ where: { spreadsheetId } });

    res.status(200).json({ sheets });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a specific sheet by ID.
 * Both owners and collaborators can access sheets.
 */
exports.getSheetById = async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId } = req.params;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to access sheet" });
      }
    }

    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    res.status(200).json({ sheet });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a sheet by ID.
 * Both owners and collaborators can update sheets.
 */
exports.updateSheet = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { spreadsheetId, sheetId } = req.params;
    const { name } = req.body;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Check if the user is the owner or a collaborator
    if (spreadsheet.ownerId !== req.user.id) {
      const isCollaborator = await spreadsheet.hasCollaborator(req.user.id);
      if (!isCollaborator) {
        return res
          .status(403)
          .json({ message: "Access denied to update sheet" });
      }
    }

    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Update sheet
    sheet.name = name;
    await sheet.save();

    // Emit event to the spreadsheet room
    const io = getIO();
    io.to(spreadsheetId).emit("sheetUpdated", { sheet });

    res.status(200).json({ sheet });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a sheet by ID.
 * Only the owner can delete sheets.
 */
exports.deleteSheet = async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId } = req.params;

    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Authorization: Only the owner can delete sheets
    if (spreadsheet.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Only the owner can delete sheets" });
    }

    const sheet = await Sheet.findOne({
      where: { id: sheetId, spreadsheetId },
    });

    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // Delete sheet
    await sheet.destroy();

    // Emit event to the spreadsheet room
    const io = getIO();
    io.to(spreadsheetId).emit("sheetDeleted", { sheetId });

    res.status(200).json({ message: "Sheet deleted successfully" });
  } catch (error) {
    next(error);
  }
};
