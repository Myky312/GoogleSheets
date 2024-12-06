// tests/factories/sheetFactory.js

const { Sheet } = require("../../models");
const { v4: uuidv4 } = require("uuid");

const createSheet = async (overrides = {}) => {
  return await Sheet.create({
    id: uuidv4(),
    spreadsheetId: overrides.spreadsheetId || "default-spreadsheet-id",
    name: "Test Sheet",
    ...overrides,
  });
};

module.exports = { createSheet };
