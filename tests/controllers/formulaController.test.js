// tests/controllers/formulaController.test.js

const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const { body, validationResult } = require("express-validator");
const formulaRoutes = require("../../routes/formulaRoutes");
const { Spreadsheet } = require("../../models");
const { evaluateFormula } = require("../../services/formulaService");

// Mock the necessary modules
jest.mock("../../models");
jest.mock("../../services/formulaService");

// Create a simple Express app for testing
const app = express();
app.use(bodyParser.json());

// Mock authentication middleware
// Assuming you have an authentication middleware that sets req.user
// For testing, we'll create a simple middleware that sets req.user
app.use((req, res, next) => {
  req.user = { id: "userId1" }; // Mock user ID
  next();
});

// Use the actual formula routes
app.use("/formula", formulaRoutes);

describe("formulaController", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Spreadsheet.findByPk to return a valid spreadsheet for spreadsheetId 1
    Spreadsheet.findByPk.mockImplementation(async (spreadsheetId) => {
      if (spreadsheetId === 1) {
        return {
          id: 1,
          ownerId: "userId1",
          hasCollaborator: jest.fn().mockResolvedValue(true),
        };
      }
      return null; // Spreadsheet not found
    });

    // Mock evaluateFormula to return a resolved promise with the expected result
    evaluateFormula.mockImplementation(async (expression, sheetId) => {
      switch (expression) {
        case "1,1*75":
          return 750;
        case "(6,1+6,11)*2,3":
          return 3450;
        case "110*75":
          return 8250;
        case "1,1*/75":
          throw new Error("Invalid formula syntax");
        case "1,1+2,2":
          throw new Error("Referenced cell not found");
        case "(3,3-1,1)/2,2 + 4":
          return 4;
        default:
          return 0;
      }
    });
  });

  describe("POST /formula/evaluate", () => {
    it("should evaluate a formula for basic arithmetic", async () => {
      const formula = "=1,1*75"; // Leading '=' is acceptable
      const mockResponse = 750; // Expected result

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBe(mockResponse);

      expect(evaluateFormula).toHaveBeenCalledWith("1,1*75", 1);
    });

    it("should handle formulas with multiple cell references", async () => {
      const formula = "=(6,1+6,11)*2,3"; // Example formula
      const mockResponse = 3450; // Expected result

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBe(mockResponse);

      expect(evaluateFormula).toHaveBeenCalledWith("(6,1+6,11)*2,3", 1);
    });

    it("should handle formulas with constants and references", async () => {
      const formula = "=110*75"; // No cell references; remains unchanged
      const mockResponse = 8250; // Expected result

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBe(mockResponse);

      expect(evaluateFormula).toHaveBeenCalledWith("110*75", 1);
    });

    it("should return an error for invalid formulas", async () => {
      const formula = "=1,1*/75"; // Invalid formula

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid formula syntax");

      expect(evaluateFormula).toHaveBeenCalledWith("1,1*/75", 1);
    });

    it("should return an error if referenced cells are missing", async () => {
      const formula = "=1,1+2,2"; // Reference missing cells

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Referenced cell not found");

      expect(evaluateFormula).toHaveBeenCalledWith("1,1+2,2", 1);
    });

    it("should evaluate a formula with multiple operations and references", async () => {
      const formula = "=(3,3-1,1)/2,2 + 4"; // Example formula
      const mockResponse = 4; // Expected result

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 1, // Numeric ID
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBe(mockResponse);

      expect(evaluateFormula).toHaveBeenCalledWith("(3,3-1,1)/2,2 + 4", 1);
    });

    // Additional tests to cover edge cases
    it("should return 404 if the spreadsheet does not exist", async () => {
      const formula = "=1,1*75"; // Valid formula

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 999, // Non-existent spreadsheet ID
          sheetId: 1,          // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Spreadsheet not found");

      expect(evaluateFormula).not.toHaveBeenCalled();
    });

    it("should return 403 if the user does not have access to the spreadsheet", async () => {
      // Mock Spreadsheet.findByPk to return a spreadsheet where user is not the owner and not a collaborator
      Spreadsheet.findByPk.mockImplementation(async (spreadsheetId) => {
        if (spreadsheetId === 2) {
          return {
            id: 2,
            ownerId: "anotherUserId",
            hasCollaborator: jest.fn().mockResolvedValue(false),
          };
        }
        return null;
      });

      const formula = "=1,1*75"; // Valid formula

      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: 2, // Spreadsheet ID owned by another user
          sheetId: 1,        // Numeric ID
          formula: formula,
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied to evaluate formula");

      expect(evaluateFormula).not.toHaveBeenCalled();
    });

    it("should return 400 if required fields are missing", async () => {
      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          // Missing spreadsheetId, sheetId, and formula
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "spreadsheetId is required" }),
          expect.objectContaining({ msg: "sheetId is required" }),
          expect.objectContaining({ msg: "formula is required" }),
        ])
      );

      expect(evaluateFormula).not.toHaveBeenCalled();
    });

    it("should return 400 if spreadsheetId or sheetId are not numeric", async () => {
      const response = await request(app)
        .post("/formula/evaluate")
        .send({
          spreadsheetId: "invalid", // Non-numeric ID
          sheetId: "invalid",        // Non-numeric ID
          formula: "=1,1*75",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "spreadsheetId must be numeric", path: "spreadsheetId" }),
          expect.objectContaining({ msg: "sheetId must be numeric", path: "sheetId" }),
        ])
      );

      expect(evaluateFormula).not.toHaveBeenCalled();
    });
  });
});
