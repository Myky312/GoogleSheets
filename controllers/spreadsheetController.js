const { Spreadsheet, Sheet, User, UserSpreadsheet } = require("../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../socket");

/**
 * Create a new spreadsheet
 */
exports.createSpreadsheet = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    const ownerId = req.user.id;

    // Create the spreadsheet
    const spreadsheet = await Spreadsheet.create({ name, ownerId });

    // Create the default sheet
    const sheet = await Sheet.create({
      spreadsheetId: spreadsheet.id,
      name: "Sheet1",
    });

    // Emit an event to notify clients about the new spreadsheet
    const io = getIO();
    io.emit("spreadsheetCreated", { spreadsheet });

    res.status(201).json({ spreadsheet });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a spreadsheet
 */
exports.deleteSpreadsheet = async (req, res, next) => {
  try {
    const spreadsheetId = req.params.id;
    const userId = req.user.id;

    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only owner can delete the spreadsheet" });
    }

    await spreadsheet.destroy();

    const io = getIO();
    io.emit("spreadsheetDeleted", { spreadsheetId });

    res.status(200).json({ message: "Spreadsheet deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a collaborator to a spreadsheet
 */
exports.addCollaborator = async (req, res, next) => {
  try {
    const spreadsheetId = req.params.id;
    const { collaboratorEmail } = req.body;
    const userId = req.user.id;

    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [{ model: User, as: "Collaborators" }],
    });

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only owner can add collaborators" });
    }

    const collaborator = await User.findOne({
      where: { email: collaboratorEmail },
    });

    if (!collaborator) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    const existing = await UserSpreadsheet.findOne({
      where: { spreadsheetId, userId: collaborator.id },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "User is already a collaborator" });
    }

    await UserSpreadsheet.create({ spreadsheetId, userId: collaborator.id });

    const io = getIO();
    io.to(spreadsheetId).emit("collaboratorAdded", {
      spreadsheetId,
      collaborator,
    });

    res.status(200).json({ message: "Collaborator added successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a collaborator from a spreadsheet
 */
exports.removeCollaborator = async (req, res, next) => {
  try {
    const spreadsheetId = req.params.id;
    const { collaboratorId } = req.body;
    const userId = req.user.id;

    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [{ model: User, as: "Collaborators" }],
    });

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only owner can remove collaborators" });
    }

    if (spreadsheet.ownerId === collaboratorId) {
      return res
        .status(400)
        .json({ message: "Owner cannot be removed as a collaborator" });
    }

    const collaborator = await UserSpreadsheet.findOne({
      where: { spreadsheetId, userId: collaboratorId },
    });

    if (!collaborator) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    await collaborator.destroy();

    const io = getIO();
    io.to(spreadsheetId).emit("collaboratorRemoved", {
      spreadsheetId,
      collaboratorId,
    });

    res.status(200).json({ message: "Collaborator removed successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all spreadsheets the user owns or collaborates on
 */
exports.getSpreadsheets = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const ownedSpreadsheets = await Spreadsheet.findAll({
      where: { ownerId: userId },
      include: [{ model: Sheet, as: "Sheets" }],
    });

    const collaborations = await UserSpreadsheet.findAll({
      where: { userId },
      include: [
        {
          model: Spreadsheet,
          as: "Spreadsheet",
          include: [{ model: Sheet, as: "Sheets" }],
        },
      ],
    });

    const collaboratedSpreadsheets = collaborations.map(
      (collab) => collab.Spreadsheet
    );

    res.status(200).json({ ownedSpreadsheets, collaboratedSpreadsheets });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a spreadsheet by ID
 */
exports.getSpreadsheetById = async (req, res, next) => {
  try {
    const spreadsheetId = req.params.id;
    const userId = req.user.id;

    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [
        { model: Sheet, as: "Sheets" },
        { model: User, as: "Collaborators" },
      ],
    });

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    const isOwner = spreadsheet.ownerId === userId;
    const isCollaborator = spreadsheet.Collaborators.some(
      (user) => user.id === userId
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ spreadsheet });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a spreadsheet's name
 */
exports.updateSpreadsheet = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const spreadsheetId = req.params.id;
    const { name } = req.body;
    const userId = req.user.id;

    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only owner can update the spreadsheet" });
    }

    if (name) {
      spreadsheet.name = name;
      await spreadsheet.save();

      const io = getIO();
      io.to(spreadsheetId).emit("spreadsheetUpdated", { spreadsheet });
    }

    res.status(200).json({ spreadsheet });
  } catch (error) {
    next(error);
  }
};
