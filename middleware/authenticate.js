// middleware/authenticate.js

const jwt = require("jsonwebtoken");
const { User } = require("../models");
const logger = require("../utils/logger");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication invalid' });
  }
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = user; // Set the user in the request
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(403).json({ error: "Failed to authenticate token" });
  }  
};
