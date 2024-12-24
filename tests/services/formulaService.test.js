// tests/services/formulaService.test.js

const formulaService = require("../../services/formulaService");
const { Cell } = require("../../models");
const { Op } = require("sequelize");

jest.mock("../../models");

describe("formulaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("evaluateFormula", () => {
    it("should evaluate a simple arithmetic formula", async () => {
      const formula = "2 + 3 * 4";
      const result = await formulaService.evaluateFormula(formula, "sheetId1");
      expect(result).toBe(14);
    });

    it("should evaluate a formula with numeric cell references", async () => {
      const formula = "1,1 + 2,2"; // Changed from "A1 + B2"

      // Mock Cell.findAll
      Cell.findAll.mockResolvedValue([
        { row: 1, column: 1, content: "5", formula: null },
        { row: 2, column: 2, content: "10", formula: null },
      ]);

      const result = await formulaService.evaluateFormula(formula, "sheetId1");
      expect(result).toBe(15);

      expect(Cell.findAll).toHaveBeenCalledWith({
        where: {
          sheetId: "sheetId1",
          [Op.or]: [
            { row: 1, column: 1 },
            { row: 2, column: 2 },
          ],
        },
      });
    });

    it("should evaluate a formula with nested cell formulas", async () => {
      const formula = "1,1 + 2,2"; // Changed from "A1 + B1"

      // Mock Cell.findAll
      Cell.findAll.mockImplementation(({ where }) => {
        const results = [];
        const conditions = where[Op.or] || [];

        conditions.forEach((condition) => {
          if (condition.row === 1 && condition.column === 1) {
            // Cell "1,1" has a formula "=3,3"
            results.push({ row: 1, column: 1, content: null, formula: "=3,3" }); // Changed from "=C1"
          } else if (condition.row === 2 && condition.column === 2) {
            // Cell "2,2" has content "3"
            results.push({ row: 2, column: 2, content: "3", formula: null });
          } else if (condition.row === 3 && condition.column === 3) {
            // Cell "3,3" has content "7"
            results.push({ row: 3, column: 3, content: "7", formula: null });
          }
        });

        return Promise.resolve(results);
      });

      const result = await formulaService.evaluateFormula(formula, "sheetId1");
      expect(result).toBe(10);
    });

    it("should detect circular references", async () => {
      const formula = "1,1 + 1"; // Changed from "A1 + 1"

      Cell.findAll.mockImplementation(({ where }) => {
        if (where[Op.or][0].row === 1 && where[Op.or][0].column === 1) {
          return Promise.resolve([
            { row: 1, column: 1, content: null, formula: "=1,1" }, // Changed from "=A1"
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(
        formulaService.evaluateFormula(formula, "sheetId1")
      ).rejects.toThrow("Circular reference detected");
    });

    it("should detect circular references", async () => {
      const formula = "1,1 + 1"; // Changed from "A1 + 1"

      Cell.findAll.mockImplementation(({ where }) => {
        const results = [];
        const conditions = where[Op.or] || [];

        conditions.forEach((condition) => {
          if (condition.row === 1 && condition.column === 1) {
            // Cell "1,1" has a formula "=1,1" (circular reference)
            results.push({ row: 1, column: 1, content: null, formula: "=1,1" }); // Changed from "=A1"
          }
        });

        return Promise.resolve(results);
      });

      await expect(
        formulaService.evaluateFormula(formula, "sheetId1")
      ).rejects.toThrow("Circular reference detected");
    });

    it("should throw an error for invalid formulas", async () => {
      const formula = "2 +"; // Invalid arithmetic expression

      // Since there are no cell references, mock Cell.findAll to return an empty array
      Cell.findAll.mockResolvedValue([]);

      await expect(
        formulaService.evaluateFormula(formula, "sheetId1")
      ).rejects.toThrow("Error in formula:");
    });

    it("should treat missing cells as zero", async () => {
      const formula = "1,1 + 2,2"; // Changed from "A1 + B1"

      Cell.findAll.mockResolvedValue([
        { row: 1, column: 1, content: "5", formula: null },
        // Cell "2,2" is missing
      ]);

      const result = await formulaService.evaluateFormula(formula, "sheetId1");
      expect(result).toBe(5);
    });
  });
});
