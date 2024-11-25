// tests/controllers/__mocks__/formulaService.js

module.exports = {
  evaluateFormula: jest.fn((formula) => {
    // Simple mock implementation
    if (formula === "1+1") return "2";
    return "0";
  }),
};
