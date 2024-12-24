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
    destroy: jest.fn(),
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
jest.mock("../../services/formulaService", () => ({
  evaluateFormula: jest.fn(),
}));

const { evaluateFormula } = require("../../services/formulaService");

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
        formula: "",
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
        formula: "",
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
          formula: "",
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

  describe("createOrUpdateCell - Formula Tests", () => {
    beforeEach(() => {
      // Clear mock calls and set default resolved value
      evaluateFormula.mockClear();
      evaluateFormula.mockResolvedValue(123); // default return for successful formula evaluation
    });

    it("should evaluate formula and update content if formula starts with '=' (create mode)", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        row: 5,
        column: 3,
        content: "", // initial content
        formula: "=SUM(A1:B2)", // formula to evaluate
        hyperlink: null,
      };

      // Mock spreadsheet / sheet
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Cell does not exist, so we will CREATE
      Cell.findOne.mockResolvedValue(null);
      // Simulate DB creation
      Cell.create.mockResolvedValue({
        id: "newCellId",
        sheetId: "sheetId1",
        row: 5,
        column: 3,
        content: "", // will be overwritten after formula evaluation
        formula: "=SUM(A1:B2)",
        hyperlink: null,
        save: jest.fn(),
      });

      // Mock getIO / Socket
      const ioMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(ioMock);

      // Evaluate formula will return 123
      evaluateFormula.mockResolvedValue(123);

      await cellController.createOrUpdateCell(req, res, next);

      // After create, we expect evaluateFormula to have been called
      expect(evaluateFormula).toHaveBeenCalledWith("SUM(A1:B2)", "sheetId1");
      // Check the final response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        cell: expect.objectContaining({
          id: "newCellId",
          row: 5,
          column: 3,
          content: "123", // updated with formula result
          formula: "=SUM(A1:B2)",
        }),
      });

      // Socket emit verification
      expect(ioMock.to).toHaveBeenCalledWith("spreadsheetId1");
      expect(ioMock.emit).toHaveBeenCalledWith("cellUpdated", {
        cell: expect.any(Object),
      });
    });

    it("should return 400 if formula evaluation fails", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        row: 10,
        column: 5,
        content: "",
        formula: "=BADFORMULA(!!!)", // malformed formula
        hyperlink: null,
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Cell does not exist
      Cell.findOne.mockResolvedValue(null);
      Cell.create.mockResolvedValue({
        id: "newCellId",
        sheetId: "sheetId1",
        row: 10,
        column: 5,
        content: "",
        formula: "=BADFORMULA(!!!)",
        hyperlink: null,
        save: jest.fn(),
      });

      // Force evaluateFormula to throw an error
      evaluateFormula.mockRejectedValue(new Error("Invalid formula syntax"));

      await cellController.createOrUpdateCell(req, res, next);

      expect(evaluateFormula).toHaveBeenCalledWith(
        "BADFORMULA(!!!)",
        "sheetId1"
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Formula evaluation error: Invalid formula syntax",
      });
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
    
      // Mock dependencies
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date("2024-12-23T19:52:47.169Z"),
          updatedAt: new Date("2024-12-23T19:52:47.169Z"),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "A2",
          formula: null,
          hyperlink: null,
          createdAt: new Date("2024-12-23T19:52:47.169Z"),
          updatedAt: new Date("2024-12-23T19:52:47.169Z"),
        },
      ]);
    
      // Mock Socket.IO
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
        expect.any(Array),
        expect.objectContaining({
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          conflictFields: ["sheetId", "row", "column"],
          returning: true,
        })
      );
    
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", row: 1, column: 1 }),
          expect.objectContaining({ id: "cellId2", row: 2, column: 1 }),
        ]),
      });
    
      // Ensure Socket.IO emits a single "cellsUpdated" event with all cells
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith("cellsUpdated", {
        cells: [
          {
            id: "cellId1",
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            createdAt: new Date("2024-12-23T19:52:47.169Z"),
            updatedAt: new Date("2024-12-23T19:52:47.169Z"),
          },
          {
            id: "cellId2",
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "A2",
            formula: null,
            hyperlink: null,
            createdAt: new Date("2024-12-23T19:52:47.169Z"),
            updatedAt: new Date("2024-12-23T19:52:47.169Z"),
          },
        ],
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
    
      // Mock dependencies
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "Updated A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date("2024-12-23T19:55:11.471Z"),
          updatedAt: new Date("2024-12-23T19:55:11.471Z"),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "Updated A2",
          formula: null,
          hyperlink: "http://example.com",
          createdAt: new Date("2024-12-23T19:55:11.471Z"),
          updatedAt: new Date("2024-12-23T19:55:11.471Z"),
        },
      ]);
    
      // Mock Socket.IO
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
        expect.any(Array),
        expect.objectContaining({
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          conflictFields: ["sheetId", "row", "column"],
          returning: true,
        })
      );
    
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", content: "Updated A1" }),
          expect.objectContaining({ id: "cellId2", content: "Updated A2", hyperlink: "http://example.com" }),
        ]),
      });
    
      // Ensure Socket.IO emits a single "cellsUpdated" event with all cells
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith("cellsUpdated", {
        cells: [
          {
            id: "cellId1",
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "Updated A1",
            formula: null,
            hyperlink: null,
            createdAt: new Date("2024-12-23T19:55:11.471Z"),
            updatedAt: new Date("2024-12-23T19:55:11.471Z"),
          },
          {
            id: "cellId2",
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "Updated A2",
            formula: null,
            hyperlink: "http://example.com",
            createdAt: new Date("2024-12-23T19:55:11.471Z"),
            updatedAt: new Date("2024-12-23T19:55:11.471Z"),
          },
        ],
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
    
      // Mock dependencies
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "A1",
          formula: null,
          hyperlink: null,
          createdAt: new Date("2024-12-23T19:57:10.176Z"),
          updatedAt: new Date("2024-12-23T19:57:10.176Z"),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 1,
          content: "Updated A2",
          formula: null,
          hyperlink: null,
          createdAt: new Date("2024-12-23T19:57:10.176Z"),
          updatedAt: new Date("2024-12-23T19:57:10.176Z"),
        },
      ]);
    
      // Mock Socket.IO
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
        expect.any(Array),
        expect.objectContaining({
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          conflictFields: ["sheetId", "row", "column"],
          returning: true,
        })
      );
    
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", row: 1, column: 1 }),
          expect.objectContaining({ id: "cellId2", content: "Updated A2" }),
        ]),
      });
    
      // Ensure Socket.IO emits a single "cellsUpdated" event with all cells
      expect(toMock).toHaveBeenCalledWith("spreadsheetId1");
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith("cellsUpdated", {
        cells: [
          {
            id: "cellId1",
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            createdAt: new Date("2024-12-23T19:57:10.176Z"),
            updatedAt: new Date("2024-12-23T19:57:10.176Z"),
          },
          {
            id: "cellId2",
            sheetId: "sheetId1",
            row: 2,
            column: 1,
            content: "Updated A2",
            formula: null,
            hyperlink: null,
            createdAt: new Date("2024-12-23T19:57:10.176Z"),
            updatedAt: new Date("2024-12-23T19:57:10.176Z"),
          },
        ],
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
        array: () => [
          {
            msg: "Cells should be a non-empty array",
            param: "cells",
            location: "body",
          },
        ],
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [
          {
            msg: "Cells should be a non-empty array",
            param: "cells",
            location: "body",
          },
        ],
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
          { row: 2, column: 0, content: "A2" }, // Invalid column
        ],
      };

      // Mock validationResult to fail
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          {
            msg: "Row must be a positive integer",
            param: "cells.0.row",
            location: "body",
          },
          {
            msg: "Column must be a positive integer",
            param: "cells.1.column",
            location: "body",
          },
        ],
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [
          {
            msg: "Row must be a positive integer",
            param: "cells.0.row",
            location: "body",
          },
          {
            msg: "Column must be a positive integer",
            param: "cells.1.column",
            location: "body",
          },
        ],
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [{ row: 1, column: 1, content: "A1" }],
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
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 404 if sheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [{ row: 1, column: 1, content: "A1" }],
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
        cells: [{ row: 1, column: 1, content: "A1" }],
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
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied to modify cells",
      });
    });

    it("should handle database errors gracefully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "A1", formula: null, hyperlink: null },
        ],
      };
    
      // Mock dependencies
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
    
      // Simulate database error
      const error = new Error("Database failure during bulkCreate");
      Cell.bulkCreate.mockRejectedValue(error);
    
      // Mock Socket.IO even though bulkCreate fails
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      getIO.mockReturnValue({ to: toMock });
    
      await cellController.bulkCreateOrUpdateCells(req, res, next);
    
      // Adjusted Assertions for bulkCreate (removed 'createdAt')
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sheetId: "sheetId1",
            row: 1,
            column: 1,
            content: "A1",
            formula: null,
            hyperlink: null,
            // removed 'createdAt' as it's managed by the database
            updatedAt: expect.any(Date),
          }),
        ]),
        expect.objectContaining({
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          conflictFields: ["sheetId", "row", "column"],
          returning: true,
        })
      );
    
      // Assertions for error handling
      expect(next).toHaveBeenCalledWith(error);
    });     
  });

  describe("bulkCreateOrUpdateCells - Formula Tests", () => {
    beforeEach(() => {
      evaluateFormula.mockClear();
      jest.clearAllMocks();
      evaluateFormula.mockResolvedValue(999); // default success result
    });

    it("should evaluate formulas for multiple cells before bulk upsert", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          { row: 1, column: 1, content: "", formula: "=1+2", hyperlink: null },
          { row: 2, column: 2, content: "", formula: "=1,1*10", hyperlink: null }, // Numeric reference
          { row: 3, column: 3, content: "Plain text", formula: null, hyperlink: null },
        ],
      };
    
      // Mock dependencies
      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });
    
      // Mock formula evaluation
      evaluateFormula.mockResolvedValueOnce(3); // For "=1+2"
      evaluateFormula.mockResolvedValueOnce(30); // For "=1,1*10"
    
      // Mock Cell.bulkCreate to return created cells with 'createdAt' handled by Sequelize
      Cell.bulkCreate.mockResolvedValue([
        {
          id: "cellId1",
          sheetId: "sheetId1",
          row: 1,
          column: 1,
          content: "3",
          formula: "=1+2",
          createdAt: new Date(), // Sequelize handles this
          updatedAt: new Date(),
        },
        {
          id: "cellId2",
          sheetId: "sheetId1",
          row: 2,
          column: 2,
          content: "30",
          formula: "=1,1*10",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cellId3",
          sheetId: "sheetId1",
          row: 3,
          column: 3,
          content: "Plain text",
          formula: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    
      await cellController.bulkCreateOrUpdateCells(req, res, next);
    
      // Assertions
      expect(evaluateFormula).toHaveBeenCalledTimes(2);
      expect(evaluateFormula).toHaveBeenCalledWith("1+2", "sheetId1");
      expect(evaluateFormula).toHaveBeenCalledWith("1,1*10", "sheetId1"); // Updated call
    
      expect(Cell.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            row: 1,
            column: 1,
            content: "3",
            formula: "=1+2",
            hyperlink: null,
            sheetId: "sheetId1",
            // Remove 'createdAt' from expectations
            updatedAt: expect.any(Date),
          }),
          expect.objectContaining({
            row: 2,
            column: 2,
            content: "30",
            formula: "=1,1*10",
            hyperlink: null,
            sheetId: "sheetId1",
            updatedAt: expect.any(Date),
          }),
          expect.objectContaining({
            row: 3,
            column: 3,
            content: "Plain text",
            formula: null,
            hyperlink: null,
            sheetId: "sheetId1",
            updatedAt: expect.any(Date),
          }),
        ]),
        expect.objectContaining({
          updateOnDuplicate: ["content", "formula", "hyperlink", "updatedAt"],
          conflictFields: ["sheetId", "row", "column"],
          returning: true,
        })
      );
    
      // Ensure proper response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cells updated successfully",
        cells: expect.arrayContaining([
          expect.objectContaining({ id: "cellId1", row: 1, column: 1 }),
          expect.objectContaining({ id: "cellId2", row: 2, column: 2 }),
          expect.objectContaining({ id: "cellId3", row: 3, column: 3 }),
        ]),
      });
    });     

    it("should return 400 if any formula evaluation fails in bulk", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
      };
      req.body = {
        cells: [
          {
            row: 1,
            column: 1,
            content: "",
            formula: "=BOGUS",
            hyperlink: null,
          },
          {
            row: 2,
            column: 2,
            content: "",
            formula: "=A1*10",
            hyperlink: null,
          },
        ],
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });
      Sheet.findOne.mockResolvedValue({
        id: "sheetId1",
        spreadsheetId: "spreadsheetId1",
      });

      // Let the first formula fail
      evaluateFormula.mockImplementationOnce(() => {
        throw new Error("Invalid formula: BOGUS");
      });

      await cellController.bulkCreateOrUpdateCells(req, res, next);

      expect(evaluateFormula).toHaveBeenCalledTimes(1); // It fails on the first cell
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining("Formula evaluation error"),
      });
      expect(Cell.bulkCreate).not.toHaveBeenCalled(); // Bulk create is aborted
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

  describe("deleteRow", () => {
    beforeEach(() => {
      // Mock validationResult to pass by default
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should delete a row successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 5,
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

      // Mock Cell.destroy to delete cells in the specified row
      Cell.destroy.mockResolvedValue(10); // Suppose 10 cells deleted

      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io);

      await cellController.deleteRow(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(Cell.destroy).toHaveBeenCalledWith({
        where: { sheetId: "sheetId1", row: 5 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Row deleted successfully",
        sheetId: "sheetId1",
        row: 5,
        deletedCount: 10,
      });

      expect(io.to).toHaveBeenCalledWith("spreadsheetId1");
      expect(io.emit).toHaveBeenCalledWith("rowDeleted", {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 5,
        deletedCount: 10,
      });
    });

    it("should return 400 if validation errors are present", async () => {
      // Mock validationResult to simulate validation errors
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          {
            msg: "Row number must be a positive integer",
            param: "row",
            location: "params",
          },
        ],
      });

      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: -1, // Invalid row
      };

      await cellController.deleteRow(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [
          {
            msg: "Row number must be a positive integer",
            param: "row",
            location: "params",
          },
        ],
      });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 3,
      };
      req.user.id = "userId2"; // Not the owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.deleteRow(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can delete rows",
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 2,
      };

      Spreadsheet.findByPk.mockResolvedValue(null);

      await cellController.deleteRow(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId1");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 404 if sheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 2,
      };

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId1",
        ownerId: "userId1",
      });

      Sheet.findOne.mockResolvedValue(null); // Sheet not found

      await cellController.deleteRow(req, res, next);

      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId1", spreadsheetId: "spreadsheetId1" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sheet not found",
      });
    });

    it("should handle database errors gracefully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId1",
        sheetId: "sheetId1",
        row: 4,
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

      // Mock Cell.destroy to throw an error
      const error = new Error("Database failure during row deletion");
      Cell.destroy.mockRejectedValue(error);

      await cellController.deleteRow(req, res, next);

      expect(Cell.destroy).toHaveBeenCalledWith({
        where: { sheetId: "sheetId1", row: 4 },
      });
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteColumn", () => {
    beforeEach(() => {
      // Mock validationResult to pass by default
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should delete a column successfully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: 3,
      };
      req.user.id = "userId2"; // Owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId2",
        ownerId: "userId2",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId2",
        spreadsheetId: "spreadsheetId2",
      });

      // Mock Cell.destroy to delete cells in the specified column
      Cell.destroy.mockResolvedValue(8); // Should delete 8 cells

      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io);

      await cellController.deleteColumn(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId2");
      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId2", spreadsheetId: "spreadsheetId2" },
      });
      expect(Cell.destroy).toHaveBeenCalledWith({
        where: { sheetId: "sheetId2", column: 3 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Column deleted successfully",
        sheetId: "sheetId2",
        column: 3,
        deletedCount: 8, // Ensure this matches the mock
      });

      expect(io.to).toHaveBeenCalledWith("spreadsheetId2");
      expect(io.emit).toHaveBeenCalledWith("columnDeleted", {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: 3,
        deletedCount: 8,
      });
    });

    it("should return 400 if validation errors are present", async () => {
      // Mock validationResult to fail
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          {
            msg: "Column number must be a positive integer",
            param: "column",
            location: "params",
          },
        ],
      });

      req.params = {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: -2, // Invalid column
      };

      await cellController.deleteColumn(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [
          {
            msg: "Column number must be a positive integer",
            param: "column",
            location: "params",
          },
        ],
      });
    });

    it("should return 403 if user is not authorized", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: 4,
      };
      req.user.id = "userId3"; // Not the owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId2",
        ownerId: "userId2",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      await cellController.deleteColumn(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("spreadsheetId2");
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can delete columns",
      });
    });

    it("should return 404 if sheet not found", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: 3,
      };
      req.user.id = "userId2"; // Owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId2",
        ownerId: "userId2",
        hasCollaborator: jest.fn().mockResolvedValue(false),
      });

      // Mock Sheet.findOne to return null, simulating sheet not found
      Sheet.findOne.mockResolvedValue(null);

      await cellController.deleteColumn(req, res, next);

      expect(Sheet.findOne).toHaveBeenCalledWith({
        where: { id: "sheetId2", spreadsheetId: "spreadsheetId2" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sheet not found",
      });
    });

    it("should handle database errors gracefully", async () => {
      req.params = {
        spreadsheetId: "spreadsheetId2",
        sheetId: "sheetId2",
        column: 6,
      };
      req.user.id = "userId2"; // Owner

      Spreadsheet.findByPk.mockResolvedValue({
        id: "spreadsheetId2",
        ownerId: "userId2",
      });

      Sheet.findOne.mockResolvedValue({
        id: "sheetId2",
        spreadsheetId: "spreadsheetId2",
      });

      // Mock Cell.destroy to throw an error
      const error = new Error("Database failure during column deletion");
      Cell.destroy.mockRejectedValue(error);

      await cellController.deleteColumn(req, res, next);

      expect(Cell.destroy).toHaveBeenCalledWith({
        where: { sheetId: "sheetId2", column: 6 },
      });
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
