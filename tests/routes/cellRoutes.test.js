// tests/routes/cellRoutes.test.js

const request = require("supertest");
const express = require("express");
const cellRoutes = require("../../routes/cellRoutes");
const cellController = require("../../controllers/cellController");
const authenticate = require("../../middleware/authenticate");

jest.mock("../../controllers/cellController");
jest.mock("../../middleware/authenticate");

describe("Cell Routes", () => {
  let app;
  const validSpreadsheetId = "00000000-0000-0000-0000-000000000000";
  const validSheetId = "00000000-0000-0000-0000-000000000001";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    authenticate.mockImplementation((req, res, next) => {
      req.user = { id: "userId1" };
      next();
    });

    // Mount the router
    app.use("/spreadsheets/:spreadsheetId/sheets/:sheetId/cells", cellRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /spreadsheets/:spreadsheetId/sheets/:sheetId/cells", () => {
    it("should create or update a cell successfully", async () => {
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(200).json({ cell: { id: "cellId1", ...req.body } });
      });

      const response = await request(app)
        .post(
          `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
        )
        .send({
          row: 1,
          column: 1,
          content: "10",
          formula: null,
          hyperlink: null,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        cell: {
          id: "cellId1",
          row: 1,
          column: 1,
          content: "10",
          formula: null,
          hyperlink: null,
        },
      });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });

    it("should return 400 for validation errors", async () => {
      const response = await request(app)
        .post(
          `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
        )
        .send({
          row: -1, // Invalid row
          column: 1,
          content: "10",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Row number must be a positive integer",
            path: "row",
            location: "body",
          }),
        ])
      );
    });

    it("should return 403 if user is not authorized", async () => {
      // Mock authentication middleware to simulate unauthorized user
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "unauthorizedUserId" };
        next();
      });

      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(403).json({ message: "Access denied to modify cells" });
      });

      const response = await request(app)
        .post(
          `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
        )
        .send({
          row: 1,
          column: 1,
          content: "10",
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to modify cells",
      });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });

    it("should handle server errors", async () => {
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app)
        .post(
          `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
        )
        .send({
          row: 1,
          column: 1,
          content: "10",
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });
  });

  describe("GET /spreadsheets/:spreadsheetId/sheets/:sheetId/cells", () => {
    it("should retrieve all cells successfully", async () => {
      const mockCells = [
        { id: "cellId1", row: 1, column: 1, content: "10" },
        { id: "cellId2", row: 1, column: 2, content: "20" },
      ];

      cellController.getCells.mockImplementation((req, res) => {
        res.status(200).json({ cells: mockCells });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cells: mockCells });
      expect(cellController.getCells).toHaveBeenCalled();
    });

    it("should return 403 if user is not authorized", async () => {
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "unauthorizedUserId" };
        next();
      });

      cellController.getCells.mockImplementation((req, res) => {
        res.status(403).json({ message: "Access denied to view cells" });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Access denied to view cells" });
      expect(cellController.getCells).toHaveBeenCalled();
    });

    it("should handle server errors", async () => {
      cellController.getCells.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.getCells).toHaveBeenCalled();
    });
  });

  describe("GET /spreadsheets/:spreadsheetId/sheets/:sheetId/cells/:row/:column", () => {
    it("should retrieve a specific cell successfully", async () => {
      const mockCell = { id: "cellId1", row: 1, column: 1, content: "10" };

      cellController.getCell.mockImplementation((req, res) => {
        res.status(200).json({ cell: mockCell });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cell: mockCell });
      expect(cellController.getCell).toHaveBeenCalled();
    });

    it("should return 404 if cell is not found", async () => {
      cellController.getCell.mockImplementation((req, res) => {
        res.status(404).json({ message: "Cell not found" });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/999/999`
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Cell not found" });
      expect(cellController.getCell).toHaveBeenCalled();
    });

    it("should return 400 for invalid parameters", async () => {
      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/invalid/1`
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Row number must be a positive integer",
            path: "row",
            location: "params",
          }),
        ])
      );
    });

    it("should handle server errors", async () => {
      cellController.getCell.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app).get(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.getCell).toHaveBeenCalled();
    });
  });

  describe("DELETE /spreadsheets/:spreadsheetId/sheets/:sheetId/cells/:row/:column", () => {
    it("should delete a cell successfully", async () => {
      cellController.deleteCell.mockImplementation((req, res) => {
        res.status(200).json({ message: "Cell deleted" });
      });

      const response = await request(app).delete(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Cell deleted" });
      expect(cellController.deleteCell).toHaveBeenCalled();
    });

    it("should return 404 if cell to delete is not found", async () => {
      cellController.deleteCell.mockImplementation((req, res) => {
        res.status(404).json({ message: "Cell not found" });
      });

      const response = await request(app).delete(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/999/999`
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Cell not found" });
      expect(cellController.deleteCell).toHaveBeenCalled();
    });

    it("should return 403 if user is not authorized to delete the cell", async () => {
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "unauthorizedUserId" };
        next();
      });

      cellController.deleteCell.mockImplementation((req, res) => {
        res.status(403).json({ message: "Access denied to delete cell" });
      });

      const response = await request(app).delete(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to delete cell",
      });
      expect(cellController.deleteCell).toHaveBeenCalled();
    });

    it("should handle server errors", async () => {
      cellController.deleteCell.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app).delete(
        `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.deleteCell).toHaveBeenCalled();
    });
  });
});
