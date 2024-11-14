// app.js

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const logger = require("./utils/logger");
const bodyParser = require("body-parser");
const authenticate = require("./middleware/authenticate");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
// const sheetRoutes = require("./routes/sheetRoutes");
const errorHandler = require("./middleware/errorHandler");
const app = express();

// Apply Middlewares
// console.log('authenticate:', authenticate);
// console.log('authRoutes:', authRoutes);
// console.log('spreadsheetRoutes:', spreadsheetRoutes);
// Set security HTTP headers
app.use(helmet());
app.use(bodyParser.json());

// Enable CORS
app.use(
  cors({
    origin: "*", // Replace with your frontend's domain
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Apply rate limiter to auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/auth", authLimiter);

app.use(errorHandler);

// Parse incoming JSON requests
app.use(express.json());

// Set Up Routes
// Public routes
app.use("/auth", authRoutes);

// Protected routes
app.use("/spreadsheets", authenticate, spreadsheetRoutes);
// app.use("/spreadsheets", authenticate, sheetRoutes);

// Swagger Documentation
// console.log(JSON.stringify(swaggerSpec, null, 2)); // Log the Swagger JSON spec

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

module.exports = app;
