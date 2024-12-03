// middleware/authenticate.js

const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { User } = require("../models");

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("No token provided in Authorization header");
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      logger.warn(`User not found: ID ${decoded.userId}`);
      return res.status(401).json({ error: "Unauthorized - User not found" });
    }

    req.user = user; // Attach user to request
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, { error });
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
};

module.exports = authenticate;
