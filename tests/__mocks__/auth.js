// tests/__mocks__/auth.js

module.exports = {
  authenticate: jest.fn((req, res, next) => {
    // Simulate authenticated user
    req.user = { id: "123e4567-e89b-12d3-a456-426614174000" };
    next();
  }),
};
