// services/authService.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

exports.register = async (username, email, password) => {
  // Check if username or email already exists
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [{ username }, { email }],
    },
  });
  if (existingUser) {
    logger.warn(
      `Registration attempt with existing username or email: ${username}, ${email}`
    );
    throw new Error("Username or email already exists");
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create the user
  const user = await User.create({
    username,
    email,
    passwordHash: hashedPassword,
  });

  logger.info(`User registered successfully: ${username}`);
  return user;
};

exports.login = async (username, password) => {
  // Find the user by username
  const user = await User.findOne({ where: { username } });
  if (!user) {
    throw new Error("User not found");
  }

  // Compare passwords
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error("Invalid password");
  }

  // Generate access token and refresh token
  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "5h",
  });
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );
  
  // Optionally, store the refresh token in the database
  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};
