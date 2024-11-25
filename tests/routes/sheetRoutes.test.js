// tests/routes/sheetRoutes.test.js

const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");

// Import the router
const sheetRoutes = require("../../routes/sheetRoutes");

// Mock the controller methods
jest.mock("../../controllers/sheetController", () => ({
  createSheet: jest.fn((req, res) =>
    res.status(201).json({ message: "createSheet" })
  ),
  getSheets: jest.fn((req, res) =>
    res.status(200).json({ message: "getSheets" })
  ),
  getSheetById: jest.fn((req, res) =>
    res.status(200).json({ message: "getSheetById" })
  ),
  updateSheet: jest.fn((req, res) =>
    res.status(200).json({ message: "updateSheet" })
  ),
  deleteSheet: jest.fn((req, res) =>
    res.status(200).json({ message: "deleteSheet" })
  ),
}));

// Mock the authentication middleware
jest.mock("../../middleware/authenticate", () => ({
  authenticate: jest.fn((req, res, next) => {
    // Simulate authenticated user
    req.user = { id: "123e4567-e89b-12d3-a456-426614174000" };
    next();
  }),
}));

const { body, param } = require("express-validator");

describe("Sheet Routes", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(bodyParser.json());

    // Import and use the authentication middleware
    const { authenticate } = require("../../middleware/authenticate");
    app.use(authenticate);

    // Mount the router
    app.use("/spreadsheets", sheetRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const sheetController = require("../../controllers/sheetController");
  const authMiddleware = require("../../middleware/authenticate");

  describe("POST /:spreadsheetId/sheets", () => {
    it("should create a new sheet when provided valid data", async () => {
      const response = await request(app)
        .post("/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets")
        .send({ name: "New Sheet" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ message: "createSheet" });

      expect(sheetController.createSheet).toHaveBeenCalled();
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });

    it("should return 400 when name is missing", async () => {
      const response = await request(app)
        .post("/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      // The controller should not be called due to validation error
      expect(sheetController.createSheet).not.toHaveBeenCalled();
    });

    it("should return 400 when spreadsheetId is invalid", async () => {
      const response = await request(app)
        .post("/spreadsheets/invalid-uuid/sheets")
        .send({ name: "New Sheet" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.createSheet).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", async () => {
      // Mock authenticate middleware to simulate unauthenticated user
      authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ message: "Unauthorized" });
      });

      const response = await request(app)
        .post("/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets")
        .send({ name: "New Sheet" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Unauthorized" });

      expect(sheetController.createSheet).not.toHaveBeenCalled();
    });
  });

  describe("GET /:spreadsheetId/sheets", () => {
    it("should retrieve all sheets when user is authenticated", async () => {
      const response = await request(app).get(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets"
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "getSheets" });

      expect(sheetController.getSheets).toHaveBeenCalled();
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });

    it("should return 400 when spreadsheetId is invalid", async () => {
      const response = await request(app).get(
        "/spreadsheets/invalid-uuid/sheets"
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.getSheets).not.toHaveBeenCalled();
    });
  });

  describe("GET /:spreadsheetId/sheets/:sheetId", () => {
    it("should retrieve a sheet when user is authenticated", async () => {
      const response = await request(app).get(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/660e8400-e29b-41d4-a716-446655440111"
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "getSheetById" });

      expect(sheetController.getSheetById).toHaveBeenCalled();
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });

    it("should return 400 when sheetId is invalid", async () => {
      const response = await request(app).get(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/invalid-uuid"
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.getSheetById).not.toHaveBeenCalled();
    });
  });

  describe("PUT /:spreadsheetId/sheets/:sheetId", () => {
    it("should update a sheet when provided valid data", async () => {
      const response = await request(app)
        .put(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/660e8400-e29b-41d4-a716-446655440111"
        )
        .send({ name: "Updated Sheet Name" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "updateSheet" });

      expect(sheetController.updateSheet).toHaveBeenCalled();
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });

    it("should return 400 when name is missing", async () => {
      const response = await request(app)
        .put(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/660e8400-e29b-41d4-a716-446655440111"
        )
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.updateSheet).not.toHaveBeenCalled();
    });

    it("should return 400 when sheetId is invalid", async () => {
      const response = await request(app)
        .put(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/invalid-uuid"
        )
        .send({ name: "Updated Sheet Name" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.updateSheet).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:spreadsheetId/sheets/:sheetId", () => {
    it("should delete a sheet when user is authenticated", async () => {
      const response = await request(app).delete(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/660e8400-e29b-41d4-a716-446655440111"
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "deleteSheet" });

      expect(sheetController.deleteSheet).toHaveBeenCalled();
      expect(authMiddleware.authenticate).toHaveBeenCalled();
    });

    it("should return 400 when sheetId is invalid", async () => {
      const response = await request(app).delete(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/invalid-uuid"
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");

      expect(sheetController.deleteSheet).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", async () => {
      // Mock authenticate middleware to simulate unauthenticated user
      authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ message: "Unauthorized" });
      });

      const response = await request(app).delete(
        "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/sheets/660e8400-e29b-41d4-a716-446655440111"
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Unauthorized" });

      expect(sheetController.deleteSheet).not.toHaveBeenCalled();
    });
  });
});
