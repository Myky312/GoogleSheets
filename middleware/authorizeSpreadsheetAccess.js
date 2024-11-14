// middleware/authorizeSpreadsheetAccess.js

const { Spreadsheet, UserSpreadsheet } = require("../models");
const logger = require("../utils/logger");

const authorizeSpreadsheetAccess = async (req, res, next) => {
  const { spreadsheetId } = req.params;
  const userId = req.user.id; 

  try {
    // Fetch the spreadsheet
    const spreadsheet = await Spreadsheet.findByPk(spreadsheetId);

    if (!spreadsheet) {
      logger.warn(`Spreadsheet not found: ID ${spreadsheetId}`);
      return res.status(404).json({ error: "Spreadsheet not found" });
    }

    // Check if the user is the owner
    if (spreadsheet.ownerId === userId) {
      req.spreadsheet = spreadsheet; // Attach spreadsheet to request for further use
      return next();
    }

    // Check if the user is a collaborator
    const userSpreadsheet = await UserSpreadsheet.findOne({
      where: {
        spreadsheetId,
        userId,
      },
    });

    if (userSpreadsheet) {
      req.spreadsheet = spreadsheet; // Attach spreadsheet to request for further use
      return next();
    }

    // If neither owner nor collaborator, deny access
    logger.warn(
      `User ${userId} attempted unauthorized access to spreadsheet ${spreadsheetId}`
    );
    return res
      .status(403)
      .json({
        error: "Forbidden - You do not have access to this spreadsheet",
      });
  } catch (error) {
    logger.error(`Authorization error: ${error.message}`, { error });
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = authorizeSpreadsheetAccess;
