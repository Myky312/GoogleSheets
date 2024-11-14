// controllers/spreadsheetController.js

const SpreadsheetService = require("../services/spreadsheetService");
const { getIO } = require("../socket");

class SpreadsheetController {
  static async createSpreadsheet(req, res, next) {
    try {
      const { name } = req.body;
      const ownerId = req.user.id;
      const spreadsheet = await SpreadsheetService.createSpreadsheet(
        name,
        ownerId
      );

      // Emit Socket.IO event
      const io = getIO();
      io.to(ownerId).emit("spreadsheetCreated", { spreadsheet });

      res.status(201).json({ success: true, data: spreadsheet });
    } catch (error) {
      next(error);
    }
  }

  static async getAllSpreadsheets(req, res, next) {
    try {
      const userId = req.user.id;
      const spreadsheets = await SpreadsheetService.getAllSpreadsheets(userId);
      res.status(200).json({ success: true, data: spreadsheets });
    } catch (error) {
      next(error);
    }
  }

  static async getSpreadsheetById(req, res, next) {
    try {
      const { spreadsheetId } = req.params;
      const userId = req.user.id;
      const spreadsheet = await SpreadsheetService.getSpreadsheetById(
        spreadsheetId,
        userId
      );
      res.status(200).json({ success: true, data: spreadsheet });
    } catch (error) {
      next(error);
    }
  }

  static async updateSpreadsheet(req, res, next) {
    try {
      const { spreadsheetId } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      const updatedSpreadsheet = await SpreadsheetService.updateSpreadsheet(
        spreadsheetId,
        updates,
        userId
      );
      res.status(200).json({ success: true, data: updatedSpreadsheet });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSpreadsheet(req, res, next) {
    try {
      const { spreadsheetId } = req.params;
      const userId = req.user.id;
      await SpreadsheetService.deleteSpreadsheet(spreadsheetId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async addUserToSpreadsheet(req, res, next) {
    try {
      const { spreadsheetId } = req.params;
      const { userId } = req.body;
      const currentUserId = req.user.id;
      await SpreadsheetService.addUserToSpreadsheet(
        spreadsheetId,
        userId,
        currentUserId
      );

      // Emit Socket.IO event
      const io = getIO();
      io.to(userId).emit("userAdded", { spreadsheetId, userId });

      res.status(200).json({
        success: true,
        message: "User added to spreadsheet successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeUserFromSpreadsheet(req, res, next) {
    try {
      const { spreadsheetId, userId } = req.params;
      const currentUserId = req.user.id;
      await SpreadsheetService.removeUserFromSpreadsheet(
        spreadsheetId,
        userId,
        currentUserId
      );

      // Emit Socket.IO event
      const io = getIO();
      io.to(userId).emit("userRemoved", { spreadsheetId, userId });

      res.status(200).json({
        success: true,
        message: "User removed from spreadsheet successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SpreadsheetController;
