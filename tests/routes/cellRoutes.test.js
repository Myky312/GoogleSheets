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
    it("should create or update a cell successfully (no formula)", async () => {
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

    it("should create or update a cell successfully (with formula)", async () => {
      // Mock controller returning a success response with evaluated formula content
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(200).json({
          cell: {
            id: "cellIdWithFormula",
            ...req.body,
            content: "123", // Suppose the evaluated result is "123"
          },
        });
      });

      const response = await request(app)
        .post(
          `/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`
        )
        .send({
          row: 2,
          column: 3,
          content: "", // initially empty
          formula: "=SUM(A1:A5)", // formula
          hyperlink: null,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        cell: {
          id: "cellIdWithFormula",
          row: 2,
          column: 3,
          content: "123", // evaluated result
          formula: "=SUM(A1:A5)",
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

  describe("PUT /spreadsheets/:spreadsheetId/sheets/:sheetId/cells/:row/:column (Single Cell)", () => {
    it("should update a single cell successfully (no formula)", async () => {
      // Mock controller to return 200
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(200).json({
          cell: {
            id: "cellIdSingleNoFormula",
            row: req.params.row,      // from URL param
            column: req.params.column,
            content: req.body.content,
            formula: req.body.formula,
          },
        });
      });

      const response = await request(app)
        // Make sure the path includes :row/:column
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/10/5`)
        .send({ content: "Updated Content", formula: null });

      // Expect success
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        cell: {
          id: "cellIdSingleNoFormula",
          row: "10",    // param is a string in Express
          column: "5",
          content: "Updated Content",
          formula: null,
        },
      });

      // Ensure the controller was called
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });

    it("should update a single cell with formula successfully", async () => {
      // Mock data: Assume cell A1 (row=1, column=1) has content "10"
      const mockSpreadsheetData = {
        "1,1": "10", // key format: "row,column"
      };

      // Simple formula evaluator for demonstration
      const evaluateFormula = (formula) => {
        // Extract cell reference and operation, e.g., "=A1+10"
        const match = formula.match(/^=A(\d+)\+(\d+)$/);
        if (match) {
          const row = match[1];
          const number = match[2];
          const cellValue = parseInt(mockSpreadsheetData[`${row},1`], 10); // Fixed typo here
          if (!isNaN(cellValue)) {
            return (cellValue + parseInt(number, 10)).toString();
          }
        }
        // Default mock value if formula is not recognized
        return "999";
      };

      // Mock controller to evaluate formula
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        let evaluatedContent = req.body.content;

        if (req.body.formula) {
          evaluatedContent = evaluateFormula(req.body.formula);
        }

        res.status(200).json({
          cell: { 
            id: "cellIdSingleWithFormula", 
            row: req.params.row, 
            column: req.params.column,
            content: evaluatedContent, // evaluated result
            formula: req.body.formula,
          },
        });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/5/3`)
        .send({
          content: "",
          formula: "=A1+10",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        cell: {
          id: "cellIdSingleWithFormula",
          row: "5",
          column: "3",
          content: "20",    // evaluated result based on mockSpreadsheetData
          formula: "=A1+10",
        },
      });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });

    it("should return 400 if single cell validation fails (e.g., row=0)", async () => {
      // No need to mock the controller since validation should fail before it gets called

      const response = await request(app)
        // row=0 should fail the `.isInt({ min: 1 })`
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/0/3`)
        .send({ content: "Invalid" });

      expect(response.status).toBe(400);

      // The validation message should match the updated route
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "Row must be a positive integer" }),
        ])
      );

      // Since validation failed, the controller should NOT be called
      expect(cellController.createOrUpdateCell).not.toHaveBeenCalled();
    });

    it("should return 403 if user is not authorized (single cell)", async () => {
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "unauthorizedUserId" };
        next();
      });

      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(403).json({ message: "Access denied to modify cells" });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/1/1`)
        .send({ content: "No Access" });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Access denied to modify cells" });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });

    it("should handle server errors on single cell PUT", async () => {
      cellController.createOrUpdateCell.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells/2/2`)
        .send({ content: "Oops" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.createOrUpdateCell).toHaveBeenCalled();
    });
  });

  describe("PUT /spreadsheets/:spreadsheetId/sheets/:sheetId/cells (Bulk)", () => {
    it("should bulk update cells successfully without formulas", async () => {
      cellController.bulkCreateOrUpdateCells.mockImplementation((req, res) => {
        res.status(200).json({
          message: "Cells updated successfully",
          cells: req.body.cells.map((cell, idx) => ({
            id: `cellId${idx}`,
            ...cell,
          })),
        });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`)
        .send({
          cells: [
            { row: 1, column: 1, content: "BulkCell A" },
            { row: 2, column: 2, content: "BulkCell B" },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Cells updated successfully",
        cells: [
          { id: "cellId0", row: 1, column: 1, content: "BulkCell A" },
          { id: "cellId1", row: 2, column: 2, content: "BulkCell B" },
        ],
      });
      expect(cellController.bulkCreateOrUpdateCells).toHaveBeenCalled();
    });

    it("should bulk update cells with formulas successfully", async () => {
      // Mock data: Assume cell A1 (row=1, column=1) has content "10"
      const mockSpreadsheetData = {
        "1,1": "10",
      };

      // Simple formula evaluator for demonstration
      const evaluateFormula = (formula) => {
        const match = formula.match(/^=A(\d+)\+(\d+)$/);
        if (match) {
          const row = match[1];
          const number = match[2];
          const cellValue = parseInt(mockSpreadsheetData[`${row},1`], 10);
          if (!isNaN(cellValue)) {
            return (cellValue + parseInt(number, 10)).toString();
          }
        }
        // Default mock value if formula is not recognized
        return "999";
      };

      // Mock controller to evaluate formulas in bulk
      cellController.bulkCreateOrUpdateCells.mockImplementation((req, res) => {
        const updatedCells = req.body.cells.map((cell) => {
          let evaluatedContent = cell.content;

          if (cell.formula) {
            evaluatedContent = evaluateFormula(cell.formula);
          }

          return {
            id: `bulkFormulaCellId${cell.row}-${cell.column}`,
            row: cell.row,
            column: cell.column,
            content: evaluatedContent,
            formula: cell.formula,
          };
        });

        res.status(200).json({
          message: "Cells updated successfully",
          cells: updatedCells,
        });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`)
        .send({
          cells: [
            { row: 3, column: 4, content: "", formula: "=A1+10" }, // Should evaluate to 20
            { row: 5, column: 6, content: "", formula: "=A1+20" }, // Should evaluate to 30
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Cells updated successfully",
        cells: [
          {
            id: "bulkFormulaCellId3-4",
            row: 3,
            column: 4,
            content: "20",    // evaluated result
            formula: "=A1+10",
          },
          {
            id: "bulkFormulaCellId5-6",
            row: 5,
            column: 6,
            content: "30",    // evaluated result
            formula: "=A1+20",
          },
        ],
      });
      expect(cellController.bulkCreateOrUpdateCells).toHaveBeenCalled();
    });

    it("should return 400 if 'cells' array is invalid or missing", async () => {
      // If validation fails, the controller won't be called.

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`)
        // No 'cells' field => invalid shape
        .send({ foo: "bar" });

      expect(response.status).toBe(400);
      // The error might mention something like "Cells should be a non-empty array"
      // depending on how your bulkUpdateCellsValidator is coded.
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "Cells should be a non-empty array" }),
        ])
      );

      // Controller should not be called if validation short-circuits
      expect(cellController.bulkCreateOrUpdateCells).not.toHaveBeenCalled();
    });

    it("should return 403 if user is not authorized (bulk)", async () => {
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "unauthorizedUserId" };
        next();
      });

      cellController.bulkCreateOrUpdateCells.mockImplementation((req, res) => {
        res.status(403).json({ message: "Access denied to modify cells" });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`)
        .send({
          cells: [{ row: 1, column: 1, content: "Bulk unauthorized" }],
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Access denied to modify cells" });
      expect(cellController.bulkCreateOrUpdateCells).toHaveBeenCalled();
    });

    it("should handle server errors (bulk)", async () => {
      cellController.bulkCreateOrUpdateCells.mockImplementation((req, res) => {
        res.status(500).json({ message: "Internal server error" });
      });

      const response = await request(app)
        .put(`/spreadsheets/${validSpreadsheetId}/sheets/${validSheetId}/cells`)
        .send({
          cells: [{ row: 9, column: 9, content: "Some content" }],
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Internal server error" });
      expect(cellController.bulkCreateOrUpdateCells).toHaveBeenCalled();
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
