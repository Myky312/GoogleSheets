// tests/__mocks__/socket.js

module.exports = {
  getIO: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
};
