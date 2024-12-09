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
    bulkCreate: jest.fn(),
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

  describe("bulkCreateOrUpdateCells", () => {
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

      // Mock validationResult to pass by default
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should bulk create cells successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1", formula: null, hyperlink: null },
          { row: 2, column: 1, content: "A2", formula: null, hyperlink: null },
        ],
      };

      // Mock Spreadsheet.findByPk
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      // Mock Sheet.findOne
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Mock Cell.bulkCreate with upsert
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "A2",
          formula: null,
          hyperlink: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock getIO and Socket.IO methods
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      // Assertions
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        [
          {
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
          {
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "A2",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        ],
        {
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          returning: true,
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", row: 1, column: 1 }),
          expect.objectContaining({ id: "cellId2", row: 2, column: 1 }),
        ]),
      });

      // Ensure Socket.IO emits events for each cell
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(2);
      expect(emitMock).toHaveBeenCalledWith("cellUpdated", {
        cell: expect.any(Object),
      });
    });

    it("should bulk update cells successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "Updated A1", formula: null, hyperlink: null },
          { row: 2, column: 1, content: "Updated A2", formula: null, hyperlink: "http://example.com" },
        ],
      };

      // Mock Spreadsheet.findByPk
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      // Mock Sheet.findOne
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Mock Cell.bulkCreate with upsert
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "Updated A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "Updated A2",
          formula: null,
          hyperlink: "http://example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock getIO and Socket.IO methods
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      // Assertions
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        [
          {
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "Updated A1",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
          {
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "Updated A2",
            formula: null,
            hyperlink: "http://example.com",
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        ],
        {
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          returning: true,
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", content: "Updated A1" }),
          expect.objectContaining({ id: "cellId2", content: "Updated A2", hyperlink: "http://example.com" }),
        ]),
      });

      // Ensure Socket.IO emits events for each cell
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(2);
      expect(emitMock).toHaveBeenCalledWith("cellUpdated", {
        cell: expect.any(Object),
      });
    });

    it("should handle mixed create and update operations", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1", formula: null, hyperlink: null }, // Create
          { row: 2, column: 1, content: "Updated A2", formula: null, hyperlink: null }, // Update
        ],
      };

      // Mock Spreadsheet.findByPk
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      // Mock Sheet.findOne
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Mock Cell.bulkCreate with upsert
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "Updated A2",
          formula: null,
          hyperlink: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock getIO and Socket.IO methods
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      // Assertions
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        [
          {
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
          {
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "Updated A2",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        ],
        {
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          returning: true,
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", row: 1, column: 1 }),
          expect.objectContaining({ id: "cellId2", content: "Updated A2" }),
        ]),
      });

      // Ensure Socket.IO emits events for each cell
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(2);
      expect(emitMock).toHaveBeenCalledWith("cellUpdated", {
        cell: expect.any(Object),
      });
    });

    it("should return 400 if 'cells' array is empty", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [],
      };

      // Mock validationResult to fail
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Cells should be a non-empty array", param: "cells", location: "body" }],
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Cells should be a non-empty array", param: "cells", location: "body" }],
      });
    });

    it("should return 400 for invalid cell data", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: -1, column: 1, content: "A1" }, // Invalid row
          { row: 2, column: 0, content: "A2" },  // Invalid column
        ],
      };

      // Mock validationResult to fail
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { msg: "Row must be a positive integer", param: "cells.0.row", location: "body" },
          { msg: "Column must be a positive integer", param: "cells.1.column", location: "body" },
        ],
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [
          { msg: "Row must be a positive integer", param: "cells.0.row", location: "body" },
          { msg: "Column must be a positive integer", param: "cells.1.column", location: "body" },
        ],
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1" },
        ],
      };

      // Mock validationResult to pass
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Spreadsheet not found" });
    });

    it("should return 404 if sheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1" },
        ],
      };

      // Mock validationResult to pass
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      // Mock Sheet.findOne to return null
      Sheet.findOne.mockResolvedValue(null);

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Sheet not found" });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1" },
        ],
      };

      // Mock validationResult to pass
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      // Mock Spreadsheet.findByPk with ownerId different and no collaborator
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "ownerId",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied to modify cells" });
    });

    it("should handle database errors gracefully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1", formula: null, hyperlink: null }, // Added nulls
        ],
      };
    
      // Mock validationResult to pass
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    
      // Mock Spreadsheet.findByPk to return a valid spreadsheet
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
    
      // Mock Sheet.findOne to return a valid sheet
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
    
      // Mock Cell.bulkCreate to throw an error
      const error = new Error("Database failure during bulkCreate");
      Cell.bulkCreate.mockRejectedValue(error);
    
      await cellController.bulkCreateOrUpdateCells(req, res, next);
    
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        [
          {
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        ],
        {
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          returning: true,
        }
      );
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
