// controllers/authController.js

const { validationResult } = require("express-validator");
const authService = require("../services/authService");
const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");
const { User } = require("../models");


exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation errors during registration", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password } = req.body;
  try {
    const user = await authService.register(username, email, password);
    res
      .status(201)
      .json({ message: "User registered successfully", userId: user.id });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation errors during login", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  try {
    const { accessToken, refreshToken } = await authService.login(
      username,
      password
    );
    res.json({ accessToken, refreshToken });
    // console.log("Generated Refresh Token:", refreshToken); // In authService.js (during login)
    // console.log("Received Refresh Token:", req.body.refreshToken); // In authController.js (during refresh)
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(401).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Check if refresh token matches the stored token in the database
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      console.log("User not found for refresh token");
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // console.log("Stored Refresh Token:", user.refreshToken);
    // console.log("Provided Refresh Token:", refreshToken);
    if (user.refreshToken !== refreshToken) {
      console.log("Refresh token mismatch");
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // Generate new access and refresh tokens
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Update refresh token in the database
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    // console.log("Refresh token verification failed:", error.message);
    return res
      .status(403)
      .json({ error: "Failed to authenticate refresh token" });
  }
};
