// controllers/spreadsheetController.js

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

    // Fetch the spreadsheet along with its collaborators
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [
        {
          model: User,
          as: "Collaborators",
          attributes: ["id", "username", "email"], // Fetch only necessary fields
          through: { attributes: [] }, // Exclude junction table attributes
        },
      ],
    });

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only the owner can delete the spreadsheet" });
    }

    // Extract collaborator IDs
    const collaboratorIds = spreadsheet.Collaborators.map(
      (collaborator) => collaborator.id
    );

    // Delete the spreadsheet (this will cascade and delete related Sheets due to 'ON DELETE CASCADE')
    await spreadsheet.destroy();

    const io = getIO();

    // Notify the owner
    io.to(userId).emit("spreadsheetDeleted", { spreadsheetId });

    // Notify each collaborator
    collaboratorIds.forEach((collaboratorId) => {
      io.to(collaboratorId).emit("spreadsheetDeleted", { spreadsheetId });
    });

    res.status(200).json({ message: "Spreadsheet deleted successfully" });
  } catch (error) {
    console.error("Error deleting spreadsheet:", error);

    // Determine error type and respond accordingly
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({ message: "Invalid spreadsheet ID" });
    }

    // For other errors, pass to the global error handler
    next(error);
  }
};

/**
 * Add a collaborator to a spreadsheet
 */
exports.addCollaborator = async (req, res, next) => {
  try {
    // Validate request inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const spreadsheetId = req.params.id;
    const { collaboratorEmail } = req.body;
    const userId = req.user.id;

    // Fetch the spreadsheet along with its current collaborators
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [
        { model: User, as: "Collaborators", attributes: ["id", "email"] },
      ],
    });

    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Ensure the requester is the owner
    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only the owner can add collaborators" });
    }

    // Prevent the owner from being added as a collaborator
    const owner = await User.findByPk(userId);
    if (owner.email === collaboratorEmail) {
      return res
        .status(400)
        .json({ message: "Owner cannot be added as a collaborator" });
    }

    // Find the collaborator by email
    const collaborator = await User.findOne({
      where: { email: collaboratorEmail },
    });

    if (!collaborator) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    // Check if the user is already a collaborator
    const existing = await UserSpreadsheet.findOne({
      where: { spreadsheetId, userId: collaborator.id },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "User is already a collaborator" });
    }

    // Add the collaborator
    await UserSpreadsheet.create({ spreadsheetId, userId: collaborator.id });

    const io = getIO();

    // Emit event to notify collaborators
    io.to(`spreadsheet-${spreadsheetId}`).emit("collaboratorAdded", {
      spreadsheetId,
      collaborator: { id: collaborator.id, email: collaborator.email },
    });

    res.status(200).json({ message: "Collaborator added successfully" });
  } catch (error) {
    console.error("Error adding collaborator:", error);
    next(error);
  }
};

/**
 * Remove a collaborator from a spreadsheet with transaction
 */
exports.removeCollaborator = async (req, res, next) => {
  try {
    // Validate request inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const spreadsheetId = req.params.id;
    const { collaboratorEmail } = req.body;
    const userId = req.user.id;

    // Fetch the spreadsheet along with its current collaborators
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [
        { model: User, as: "Collaborators", attributes: ["id", "email"] },
      ],
    });
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Ensure the requester is the owner
    if (spreadsheet.ownerId !== userId) {
      return res
        .status(403)
        .json({ message: "Only the owner can remove collaborators" });
    }

    // Prevent the owner from being removed
    const owner = await User.findByPk(userId);
    if (owner.email === collaboratorEmail) {
      return res
        .status(400)
        .json({ message: "Owner cannot be removed as a collaborator" });
    }

    // Find the collaborator by email
    const collaborator = await User.findOne({
      where: { email: collaboratorEmail },
    });

    if (!collaborator) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    // Check if the user is a collaborator
    const existing = await UserSpreadsheet.findOne({
      where: { spreadsheetId, userId: collaborator.id },
    });

    if (!existing) {
      return res.status(404).json({ message: "User is not a collaborator" });
    }

    // Remove the collaborator
    await existing.destroy();

    const io = getIO();

    // Emit event to notify collaborators
    io.to(`spreadsheet-${spreadsheetId}`).emit("collaboratorRemoved", {
      spreadsheetId,
      collaborator: { id: collaborator.id, email: collaborator.email },
    });

    res.status(200).json({ message: "Collaborator removed successfully" });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    next(error);
  }
};

/**
 * Get all spreadsheets the user owns or collaborates on
 */
exports.getSpreadsheets = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch owned spreadsheets
    const ownedSpreadsheets = await Spreadsheet.findAll({
      where: { ownerId: userId },
      include: [{ model: Sheet, as: "Sheets" }],
    });

    // Fetch spreadsheets the user collaborates on
    const collaboratedSpreadsheets = await Spreadsheet.findAll({
      include: [
        {
          model: User,
          as: "Collaborators",
          where: { id: userId },
          attributes: [], // Exclude user attributes if not needed
          through: { attributes: [] }, // Exclude junction table attributes
        },
        {
          model: Sheet,
          as: "Sheets",
        },
      ],
      distinct: true, // Ensure unique results
    });

    res.status(200).json({ ownedSpreadsheets, collaboratedSpreadsheets });
  } catch (error) {
    console.error("Error fetching spreadsheets:", error);
    next(error);
  }
};

/**
 * Get a spreadsheet by ID
 */
exports.getSpreadsheetById = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    const userId = req.user.id;

    // Fetch the spreadsheet with associated Sheets and Collaborators
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
      include: [
        {
          model: Sheet,
          as: "Sheets",
          attributes: ["id", "spreadsheetId", "name", "createdAt", "updatedAt"],
        },
        {
          model: User,
          as: "Collaborators",
          attributes: ["id", "username", "email"],
          through: { attributes: [] }, // Exclude junction table attributes
        },
      ],
      attributes: ["id", "ownerId", "name", "createdAt", "updatedAt"],
    });

    // If the spreadsheet doesn't exist
    if (!spreadsheet) {
      return res.status(404).json({ message: "Spreadsheet not found" });
    }

    // Determine if the user is the owner
    const isOwner = spreadsheet.ownerId === userId;

    // Determine if the user is a collaborator
    const isCollaborator = spreadsheet.Collaborators.some(
      (collaborator) => collaborator.id === userId
    );

    // If the user is neither the owner nor a collaborator, deny access
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Optionally, you can include the owner's information if the user is a collaborator
    let owner = null;
    if (!isOwner) {
      owner = await User.findByPk(spreadsheet.ownerId, {
        attributes: ["id", "username", "email"],
      });
    }

    // Construct the response object
    const response = {
      spreadsheet: {
        id: spreadsheet.id,
        name: spreadsheet.name,
        ownerId: spreadsheet.ownerId,
        createdAt: spreadsheet.createdAt,
        updatedAt: spreadsheet.updatedAt,
        Sheets: spreadsheet.Sheets,
        Collaborators: spreadsheet.Collaborators,
        owner: owner, // Include owner's info if the user is a collaborator
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching spreadsheet by ID:", error);
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
