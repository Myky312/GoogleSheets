// tests/__mocks__/models.js

module.exports = {
  Sheet: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    // Add other methods if necessary
  },
  Spreadsheet: {
    findByPk: jest.fn(),
    
    prototype: {
      hasCollaborator: jest.fn(),
    },
    // Add other methods if necessary
  },
  // Mock other models if required
};
