// tests/controllers/sheetController.test.js

// Mocking the models
jest.mock("../../models", () => require("../__mocks__/models"));

// Mocking the socket
jest.mock("../../socket", () => require("../__mocks__/socket"));

// Mocking express-validator
jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

// Now import the modules
const sheetController = require("../../controllers/sheetController");
const { Sheet, Spreadsheet } = require("../../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../../socket");

describe("Sheet Controller", () => {
  let req, res, next, io;

  beforeEach(() => {
    // Initialize mock request, response, and next function
    req = {
      params: {},
      body: {},
      user: {
        id: "123e4567-e89b-12d3-a456-426614174000",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock the Socket.IO instance returned by getIO
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    getIO.mockReturnValue(io);
  });

  // Test suite for createSheet
  describe("createSheet", () => {
    it("should create a new sheet successfully as owner and emit an event", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.body.name = "New Sheet";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
        hasCollaborator: jest.fn(), // Not called when user is owner
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.create to return the created sheet
      const createdSheet = {
        id: "660e8400-e29b-41d4-a716-446655440111",
        spreadsheetId: req.params.spreadsheetId,
        name: req.body.name,
        toJSON: () => ({
          id: "660e8400-e29b-41d4-a716-446655440111",
          spreadsheetId: req.params.spreadsheetId,
          name: req.body.name,
        }),
      };
      Sheet.create.mockResolvedValue(createdSheet);

      // Act
      await sheetController.createSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(Sheet.create).toHaveBeenCalledWith({
        spreadsheetId: req.params.spreadsheetId,
        name: req.body.name,
      });
      expect(io.to).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(io.emit).toHaveBeenCalledWith("sheetCreated", {
        sheet: createdSheet,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ sheet: createdSheet });
    });

    it("should create a new sheet successfully as collaborator and emit an event", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.body.name = "New Sheet";
      const ownerId = "owner-id";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(true),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.create to return the created sheet
      const createdSheet = {
        id: "660e8400-e29b-41d4-a716-446655440111",
        spreadsheetId: req.params.spreadsheetId,
        name: req.body.name,
        toJSON: () => ({
          id: "660e8400-e29b-41d4-a716-446655440111",
          spreadsheetId: req.params.spreadsheetId,
          name: req.body.name,
        }),
      };
      Sheet.create.mockResolvedValue(createdSheet);

      // Act
      await sheetController.createSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(Sheet.create).toHaveBeenCalledWith({
        spreadsheetId: req.params.spreadsheetId,
        name: req.body.name,
      });
      expect(io.to).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(io.emit).toHaveBeenCalledWith("sheetCreated", {
        sheet: createdSheet,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ sheet: createdSheet });
    });

    it("should return 400 if name is missing", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.body = {}; // Missing 'name'

      // Mock validationResult to return errors
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Sheet name is required", param: "name" }],
      });

      // Act
      await sheetController.createSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Sheet name is required", param: "name" }],
      });

      // Ensure no events are emitted
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 403 if user is not authorized", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.body.name = "New Sheet";
      const ownerId = "owner-id";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is neither owner nor collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(false),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Act
      await sheetController.createSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to create sheet",
      });

      // Ensure no events are emitted
      expect(Sheet.create).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 404 if spreadsheet is not found", async () => {
      // Arrange
      req.params.spreadsheetId = "non-existent-spreadsheet-id";
      req.body.name = "New Sheet";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return null (spreadsheet not found)
      Spreadsheet.findByPk.mockResolvedValue(null);

      // Act
      await sheetController.createSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });

      // Ensure no events are emitted
      expect(Sheet.create).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });
  });

  // Test suite for deleteSheet
  describe("deleteSheet", () => {
    it("should delete a sheet successfully as owner and emit an event", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.params.sheetId = "660e8400-e29b-41d4-a716-446655440111";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return an existing sheet
      const sheet = {
        id: req.params.sheetId,
        spreadsheetId: req.params.spreadsheetId,
        name: "Sheet1",
        destroy: jest.fn().mockResolvedValue(true),
      };
      Sheet.findOne.mockResolvedValue(sheet);

      // Act
      await sheetController.deleteSheet(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(sheet.destroy).toHaveBeenCalled();
      expect(io.to).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(io.emit).toHaveBeenCalledWith("sheetDeleted", {
        sheetId: req.params.sheetId,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sheet deleted successfully",
      });
    });

    it("should return 403 if user is not owner when deleting sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      const ownerId = "owner-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is not owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Act
      await sheetController.deleteSheet(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only the owner can delete sheets",
      });

      // Ensure no deletion or events occur
      expect(Sheet.findOne).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 404 if spreadsheet is not found when deleting sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "non-existent-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";

      // Mock Spreadsheet.findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      // Act
      await sheetController.deleteSheet(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });

      // Ensure no deletion or events occur
      expect(Sheet.findOne).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 404 if sheet is not found when deleting sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "non-existent-sheet-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return null (sheet not found)
      Sheet.findOne.mockResolvedValue(null);

      // Act
      await sheetController.deleteSheet(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sheet not found",
      });

      // Ensure no deletion or events occur
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });
  });

  // Test suite for updateSheet
  describe("updateSheet", () => {
    it("should update a sheet successfully as owner and emit an event", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.params.sheetId = "660e8400-e29b-41d4-a716-446655440111";
      req.body.name = "Updated Sheet Name";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
        hasCollaborator: jest.fn(),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return an existing sheet
      const existingSheet = {
        id: req.params.sheetId,
        spreadsheetId: req.params.spreadsheetId,
        name: "Sheet1",
        save: jest.fn().mockResolvedValue(true),
      };
      Sheet.findOne.mockResolvedValue(existingSheet);

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(existingSheet.save).toHaveBeenCalled();
      expect(existingSheet.name).toBe("Updated Sheet Name");
      expect(io.to).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(io.emit).toHaveBeenCalledWith("sheetUpdated", {
        sheet: existingSheet,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheet: existingSheet });
    });

    it("should update a sheet successfully as collaborator and emit an event", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      req.body.name = "Updated Sheet Name";
      const ownerId = "owner-id";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(true),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return an existing sheet
      const existingSheet = {
        id: req.params.sheetId,
        spreadsheetId: req.params.spreadsheetId,
        name: "Sheet1",
        save: jest.fn().mockResolvedValue(true),
      };
      Sheet.findOne.mockResolvedValue(existingSheet);

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(existingSheet.save).toHaveBeenCalled();
      expect(existingSheet.name).toBe("Updated Sheet Name");
      expect(io.to).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(io.emit).toHaveBeenCalledWith("sheetUpdated", {
        sheet: existingSheet,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheet: existingSheet });
    });

    it("should return 403 if user is not authorized to update sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      req.body.name = "Updated Sheet Name";
      const ownerId = "owner-id";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is neither owner nor collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(false),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to update sheet",
      });

      // Ensure no update or events occur
      expect(Sheet.findOne).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 400 if name is missing", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      req.body = {}; // Missing 'name'

      // Mock validationResult to return errors
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Sheet name is required", param: "name" }],
      });

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Sheet name is required", param: "name" }],
      });

      // Ensure no update or events occur
      expect(Spreadsheet.findByPk).not.toHaveBeenCalled();
      expect(Sheet.findOne).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 404 if spreadsheet is not found when updating sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "non-existent-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      req.body.name = "Updated Sheet Name";

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });

      // Ensure no update or events occur
      expect(Sheet.findOne).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("should return 404 if sheet is not found when updating sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "non-existent-sheet-id";
      req.body.name = "Updated Sheet Name";
      const ownerId = req.user.id;

      // Mock validationResult to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn(),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return null (sheet not found)
      Sheet.findOne.mockResolvedValue(null);

      // Act
      await sheetController.updateSheet(req, res, next);

      // Assert
      expect(validationResult).toHaveBeenCalledWith(req);
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sheet not found",
      });

      // Ensure no update or events occur
      expect(io.to).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });
  });

  // Test suite for getSheets
  describe("getSheets", () => {
    it("should retrieve all sheets for a spreadsheet as owner", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
        hasCollaborator: jest.fn(),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findAll to return an array of sheets
      const sheets = [
        {
          id: "sheet1",
          spreadsheetId: req.params.spreadsheetId,
          name: "Sheet1",
        },
        {
          id: "sheet2",
          spreadsheetId: req.params.spreadsheetId,
          name: "Sheet2",
        },
      ];
      Sheet.findAll.mockResolvedValue(sheets);

      // Act
      await sheetController.getSheets(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(Sheet.findAll).toHaveBeenCalledWith({
        where: { spreadsheetId: req.params.spreadsheetId },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheets });
    });

    it("should retrieve all sheets for a spreadsheet as collaborator", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      const ownerId = "owner-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(true),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findAll to return an array of sheets
      const sheets = [
        {
          id: "sheet1",
          spreadsheetId: req.params.spreadsheetId,
          name: "Sheet1",
        },
        {
          id: "sheet2",
          spreadsheetId: req.params.spreadsheetId,
          name: "Sheet2",
        },
      ];
      Sheet.findAll.mockResolvedValue(sheets);

      // Act
      await sheetController.getSheets(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(Sheet.findAll).toHaveBeenCalledWith({
        where: { spreadsheetId: req.params.spreadsheetId },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheets });
    });

    it("should return 403 if user is not authorized to get sheets", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      const ownerId = "owner-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is neither owner nor collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(false),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Act
      await sheetController.getSheets(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to retrieve sheets",
      });

      // Ensure no further actions are taken
      expect(Sheet.findAll).not.toHaveBeenCalled();
    });

    it("should return 404 if spreadsheet is not found", async () => {
      // Arrange
      req.params.spreadsheetId = "non-existent-spreadsheet-id";

      // Mock Spreadsheet.findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      // Act
      await sheetController.getSheets(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        req.params.spreadsheetId
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });

      // Ensure no further actions are taken
      expect(Sheet.findAll).not.toHaveBeenCalled();
    });
  });

  // Test suite for getSheetById
  describe("getSheetById", () => {
    it("should retrieve a specific sheet as owner", async () => {
      // Arrange
      req.params.spreadsheetId = "550e8400-e29b-41d4-a716-446655440000";
      req.params.sheetId = "660e8400-e29b-41d4-a716-446655440111";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: req.user.id,
        hasCollaborator: jest.fn(),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return a sheet
      const sheet = {
        id: req.params.sheetId,
        spreadsheetId: req.params.spreadsheetId,
        name: "Sheet1",
      };
      Sheet.findOne.mockResolvedValue(sheet);

      // Act
      await sheetController.getSheetById(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheet });
    });

    it("should retrieve a specific sheet as collaborator", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      const ownerId = "owner-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(true),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return a sheet
      const sheet = {
        id: req.params.sheetId,
        spreadsheetId: req.params.spreadsheetId,
        name: "Sheet1",
      };
      Sheet.findOne.mockResolvedValue(sheet);

      // Act
      await sheetController.getSheetById(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sheet });
    });

    it("should return 403 if user is not authorized to access sheet", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";
      const ownerId = "owner-id";

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is neither owner nor collaborator)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn().mockResolvedValue(false),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Act
      await sheetController.getSheetById(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(spreadsheet.hasCollaborator).toHaveBeenCalledWith(req.user.id);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to access sheet",
      });

      // Ensure no further actions are taken
      expect(Sheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 404 if spreadsheet is not found", async () => {
      // Arrange
      req.params.spreadsheetId = "non-existent-spreadsheet-id";
      req.params.sheetId = "some-sheet-id";

      // Mock Spreadsheet.findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      // Act
      await sheetController.getSheetById(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });

      // Ensure no further actions are taken
      expect(Sheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 404 if sheet is not found", async () => {
      // Arrange
      req.params.spreadsheetId = "some-spreadsheet-id";
      req.params.sheetId = "non-existent-sheet-id";
      const ownerId = req.user.id;

      // Mock Spreadsheet.findByPk to return a spreadsheet (user is owner)
      const spreadsheet = {
        id: req.params.spreadsheetId,
        ownerId: ownerId,
        hasCollaborator: jest.fn(),
      };
      Spreadsheet.findByPk.mockResolvedValue(spreadsheet);

      // Mock Sheet.findOne to return null (sheet not found)
      Sheet.findOne.mockResolvedValue(null);

      // Act
      await sheetController.getSheetById(req, res, next);

      // Assert
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(req.params.spreadsheetId);
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: {
          id: req.params.sheetId,
          spreadsheetId: req.params.spreadsheetId,
        },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Sheet not found" });
    });
  });
  
});
