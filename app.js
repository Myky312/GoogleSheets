// app.js

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const logger = require("./utils/logger");
const authenticate = require("./middleware/authenticate");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const spreadsheetRoutes = require("./routes/spreadsheetRoutes");
const sheetRoutes = require("./routes/sheetRoutes");
const cellRoutes = require("./routes/cellRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Apply Middlewares

// Set security HTTP headers
app.use(helmet());

// Parse incoming JSON requests
app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: "*", // Replace with your frontend's domain in production
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

// Set Up Routes

// Public routes
app.use("/auth", authRoutes);

// Protected routes
app.use("/spreadsheets", authenticate, spreadsheetRoutes);
app.use("/spreadsheets/:spreadsheetId/sheets", authenticate, sheetRoutes);

app.use(
  "/spreadsheets/:spreadsheetId/sheets/:sheetId/cells",
  authenticate,
  cellRoutes
);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Error Handler (should be after all routes)
app.use(errorHandler);

module.exports = app;
