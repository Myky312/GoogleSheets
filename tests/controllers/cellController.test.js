// tests/controllers/cellController.test.js

const cellController = require("../../controllers/cellController");
const { Cell, Sheet, Spreadsheet } = require("../../models");
const { validationResult } = require("express-validator");
const { getIO } = require("../../socket");

jest.mock("../../models", () => ({
  Cell: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  Sheet: {
    findOne: jest.fn(),
  },
  Spreadsheet: {
    findByPk: jest.fn(),
  },
}));

jest.mock("express-validator");
jest.mock("../../socket");

describe("cellController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id: "userId1" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("createOrUpdateCell", () => {
    beforeEach(() => {
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should create a new cell successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        row: 1,
        column: 1,
        content: "10",
        formula: "=SUM(A1:A10)",
        hyperlink: null,
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn(),
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      Cell.findOne.mockResolvedValue(null); // Cell does not exist

      Cell.create.mockResolvedValue({
        id: "cellId1",
        ...req.body,
        sheetId: "sheetId1",
      });

      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io);

      await cellController.createOrUpdateCell(req, res, next);

      expect(Cell.create).toHaveBeenCalledWith({
        sheetId: "sheetId1",
        row: 1,
        column: 1,
        content: "10",
        formula: "=SUM(A1:A10)",
        hyperlink: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        cell: {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "10",
          formula: "=SUM(A1:A10)",
          hyperlink: null,
        },
      });
      expect(io.to).toHaveBeenCalledWith("spreadsheetId1");
      expect(io.emit).toHaveBeenCalledWith("cellUpdated", {
        cell: expect.any(Object),
      });
    });

    it("should update an existing cell successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        row: 1,
        column: 1,
        content: "20",
        formula: null,
        hyperlink: "http://example.com",
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn(),
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      const cell = {
        id: "cellId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
        content: "10",
        formula: "=SUM(A1:A10)",
        hyperlink: null,
        save: jest.fn(),
      };
      Cell.findOne.mockResolvedValue(cell);

      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io);

      await cellController.createOrUpdateCell(req, res, next);

      expect(cell.content).toBe("20");
      expect(cell.formula).toBe(null);
      expect(cell.hyperlink).toBe("http://example.com");
      expect(cell.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ cell });

      expect(io.to).toHaveBeenCalledWith("spreadsheetId1");
      expect(io.emit).toHaveBeenCalledWith("cellUpdated", { cell });
    });

    it("should return 400 if validation errors are present", async () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid data" }],
      });

      await cellController.createOrUpdateCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Invalid data" }],
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };

      Spreadsheet.findByPk.mockResolvedValue(null);

      await cellController.createOrUpdateCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "otherUserId",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.createOrUpdateCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to modify cells",
      });
    });

    it("should call next with error on exception", async () => {
      const error = new Error("Database error");
      Spreadsheet.findByPk.mockRejectedValue(error);

      await cellController.createOrUpdateCell(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getCells", () => {
    it("should retrieve all cells successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn(),
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      const mockCells = [
        { id: "cellId1", row: 1, column: 1, content: "10" },
        { id: "cellId2", row: 1, column: 2, content: "20" },
      ];

      Cell.findAll.mockResolvedValue(mockCells);

      await cellController.getCells(req, res, next);

      expect(Cell.findAll).toHaveBeenCalledWith({
        where: { sheetId: "sheetId1" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ cells: mockCells });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };

      Spreadsheet.findByPk.mockResolvedValue(null);

      await cellController.getCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "otherUserId",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.getCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to get cells",
      });
    });

    it("should call next with error on exception", async () => {
      const error = new Error("Database error");
      Spreadsheet.findByPk.mockRejectedValue(error);

      await cellController.getCells(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getCell", () => {
    it("should retrieve a specific cell successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn(),
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      const cell = { id: "cellId1", row: 1, column: 1, content: "10" };
      Cell.findOne.mockResolvedValue(cell);

      await cellController.getCell(req, res, next);

      expect(Cell.findOne).toHaveBeenCalledWith({
        where: { sheetId: "sheetId1", row: 1, column: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ cell });
    });

    it("should return 404 if cell not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 999,
        column: 999,
      };

      req.user.id = "userId1";

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      }); // Ensure sheet exists

      Cell.findOne.mockResolvedValue(null);

      await cellController.deleteCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Cell not found" });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "otherUserId",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.getCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to get cell",
      });
    });

    it("should call next with error on exception", async () => {
      const error = new Error("Database error");
      Spreadsheet.findByPk.mockRejectedValue(error);

      await cellController.getCell(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteCell", () => {
    it("should delete a cell successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
      };

      req.user.id = "userId1"; // Owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      const cell = {
        id: "cellId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
        destroy: jest.fn(),
      };
      Cell.findOne.mockResolvedValue(cell);

      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io);

      await cellController.deleteCell(req, res, next);

      expect(cell.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cell deleted successfully",
      });

      expect(io.to).toHaveBeenCalledWith("spreadsheetId1");
      expect(io.emit).toHaveBeenCalledWith("cellDeleted", {
        sheetId: "sheetId1",
        row: 1,
        column: 1,
      });
    });

    it("should return 403 if user is not the owner", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 1,
        column: 1,
      };

      req.user.id = "otherUserId";

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
      });

      await cellController.deleteCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can delete cells",
      });
    });

    it("should return 404 if cell not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 999,
        column: 999,
      };

      req.user.id = "userId1"; // Owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      Cell.findOne.mockResolvedValue(null);

      await cellController.deleteCell(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Cell not found" });
    });

    it("should call next with error on exception", async () => {
      const error = new Error("Database error");
      Spreadsheet.findByPk.mockRejectedValue(error);

      await cellController.deleteCell(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
