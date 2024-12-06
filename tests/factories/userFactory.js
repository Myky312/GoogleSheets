// tests/factories/userFactory.js

const { User } = require("../../models");
const { v4: uuidv4 } = require("uuid");

const createUser = async (overrides = {}) => {
  return await User.create({
    id: uuidv4(),
    username: "testuser",
    email: "testuser@example.com",
    passwordHash: "hashedpassword",
    ...overrides,
  });
};

module.exports = { createUser };
