// tests/routes/sheetRoutes.test.js

const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const sheetRoutes = require("../../routes/sheetRoutes");
const { sequelize, User, Spreadsheet, Sheet } = require("../../models");
const { createUser } = require("../factories/userFactory");
const { v4: uuidv4 } = require("uuid");

// Mock the socket module
jest.mock("../../socket", () => ({
  getIO: () => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));

// Mock the authentication middleware
jest.mock("../../middleware/authenticate", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: "123e4567-e89b-12d3-a456-426614174000" };
    next();
  }),
}));

const { authenticate } = require("../../middleware/authenticate");

describe("Sheet Routes", () => {
  let app;
  let owner;
  let collaborator;
  let nonCollaborator;
  let spreadsheet;

  beforeAll(async () => {
    app = express();
    app.use(bodyParser.json());
    app.use("/spreadsheets/:spreadsheetId/sheets", authenticate, sheetRoutes);
    await sequelize.sync({ force: true });

    // Create users
    owner = await createUser({
      id: "123e4567-e89b-12d3-a456-426614174000",
      username: "owner",
      email: "owner@example.com",
    });

    collaborator = await createUser({
      id: "223e4567-e89b-12d3-a456-426614174000",
      username: "collaborator",
      email: "collaborator@example.com",
    });

    nonCollaborator = await createUser({
      id: "323e4567-e89b-12d3-a456-426614174000",
      username: "noncollaborator",
      email: "noncollaborator@example.com",
    });

    // Create spreadsheet and add collaborator
    spreadsheet = await Spreadsheet.create({
      id: "550e8400-e29b-41d4-a716-446655440000",
      ownerId: owner.id,
      name: "Test Spreadsheet",
    });

    await spreadsheet.addCollaborator(collaborator.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  afterEach(async () => {
    // Clean up sheets after each test
    await Sheet.destroy({ where: {} });
    jest.clearAllMocks();
  });

  describe("POST /:spreadsheetId/sheets", () => {
    it("should create a new sheet when provided valid data by the owner", async () => {
      const response = await request(app)
        .post(`/spreadsheets/${spreadsheet.id}/sheets`)
        .send({ name: "Owner's New Sheet" });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("sheet");
      expect(response.body.sheet.name).toBe("Owner's New Sheet");

      // Verify in the database
      const sheetInDb = await Sheet.findByPk(response.body.sheet.id);
      expect(sheetInDb).not.toBeNull();
      expect(sheetInDb.name).toBe("Owner's New Sheet");
    });

    it("should create a new sheet when provided valid data by a collaborator", async () => {
      // Mock authenticate middleware to simulate collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: collaborator.id };
        next();
      });

      const response = await request(app)
        .post(`/spreadsheets/${spreadsheet.id}/sheets`)
        .send({ name: "Collaborator's New Sheet" });

      expect(response.status).toBe(201);
      expect(response.body.sheet.name).toBe("Collaborator's New Sheet");
    });

    it("should not allow non-collaborator to create a sheet", async () => {
      // Mock authenticate middleware to simulate non-collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: nonCollaborator.id };
        next();
      });

      const response = await request(app)
        .post(`/spreadsheets/${spreadsheet.id}/sheets`)
        .send({ name: "Unauthorized Sheet" });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to create sheet",
      });
    });

    it("should return 400 when creating a sheet with a duplicate name", async () => {
      // First creation should succeed
      await request(app)
        .post(`/spreadsheets/${spreadsheet.id}/sheets`)
        .send({ name: "Unique Sheet" });

      // Second creation with the same name should fail
      const response = await request(app)
        .post(`/spreadsheets/${spreadsheet.id}/sheets`)
        .send({ name: "Unique Sheet" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Sheet with this name already exists",
      });
    });
  });

  describe("GET /:spreadsheetId/sheets", () => {
    beforeEach(async () => {
      // Create sheets
      await Sheet.bulkCreate([
        { id: uuidv4(), spreadsheetId: spreadsheet.id, name: "Sheet 1" },
        { id: uuidv4(), spreadsheetId: spreadsheet.id, name: "Sheet 2" },
      ]);
    });

    it("should retrieve all sheets when user is authenticated", async () => {
      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets`
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sheets");
      expect(Array.isArray(response.body.sheets)).toBe(true);
      expect(response.body.sheets.length).toBe(2);
    });

    it("should retrieve all sheets when user is a collaborator", async () => {
      // Mock authenticate middleware to simulate collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: collaborator.id };
        next();
      });

      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets`
      );

      expect(response.status).toBe(200);
      expect(response.body.sheets.length).toBe(2);
    });

    it("should not allow non-collaborator to retrieve sheets", async () => {
      // Mock authenticate middleware to simulate non-collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: nonCollaborator.id };
        next();
      });

      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to retrieve sheets",
      });
    });
  });

  describe("GET /:spreadsheetId/sheets/:sheetId", () => {
    let sheet;

    beforeEach(async () => {
      sheet = await Sheet.create({
        id: uuidv4(),
        spreadsheetId: spreadsheet.id,
        name: "Specific Sheet",
      });
    });

    it("should retrieve a specific sheet when user is authenticated", async () => {
      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sheet");
      expect(response.body.sheet.id).toBe(sheet.id);
      expect(response.body.sheet.name).toBe("Specific Sheet");
    });

    it("should return 404 when sheet does not exist", async () => {
      const nonExistentSheetId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets/${nonExistentSheetId}`
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Sheet not found" });
    });

    it("should return 400 when sheetId is invalid", async () => {
      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets/invalid-uuid`
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
      expect(response.body.errors[0].msg).toBe("Invalid sheet ID format");
    });

    it("should return 403 when user is not authorized to access the sheet", async () => {
      // Mock authenticate middleware to simulate unauthorized user with a valid UUID
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: "00000000-0000-0000-0000-000000000000" };
        next();
      });

      const response = await request(app).get(
        `/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to access sheet",
      });
    });
  });

  describe("PUT /:spreadsheetId/sheets/:sheetId", () => {
    let sheet;

    beforeEach(async () => {
      sheet = await Sheet.create({
        id: uuidv4(),
        spreadsheetId: spreadsheet.id,
        name: "Original Sheet",
      });
    });

    it("should update a sheet when provided valid data by the owner", async () => {
      const response = await request(app)
        .put(`/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`)
        .send({ name: "Updated Sheet Name" });

      expect(response.status).toBe(200);
      expect(response.body.sheet.name).toBe("Updated Sheet Name");

      const updatedSheet = await Sheet.findByPk(sheet.id);
      expect(updatedSheet.name).toBe("Updated Sheet Name");
    });

    it("should update a sheet when provided valid data by a collaborator", async () => {
      // Mock authenticate middleware to simulate collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: collaborator.id };
        next();
      });

      const response = await request(app)
        .put(`/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`)
        .send({ name: "Collaborator Updated Sheet" });

      expect(response.status).toBe(200);
      expect(response.body.sheet.name).toBe("Collaborator Updated Sheet");
    });

    it("should not allow non-collaborator to update a sheet", async () => {
      // Mock authenticate middleware to simulate non-collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: nonCollaborator.id };
        next();
      });

      const response = await request(app)
        .put(`/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`)
        .send({ name: "Unauthorized Update" });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Access denied to update sheet",
      });
    });

    // ... Additional PUT tests as shown earlier ...
  });

  describe("DELETE /:spreadsheetId/sheets/:sheetId", () => {
    let sheet;

    beforeEach(async () => {
      sheet = await Sheet.create({
        id: uuidv4(),
        spreadsheetId: spreadsheet.id,
        name: "Sheet To Delete",
      });
    });

    it("should delete a sheet when user is the owner", async () => {
      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Sheet deleted successfully" });

      const deletedSheet = await Sheet.findByPk(sheet.id);
      expect(deletedSheet).toBeNull();
    });

    it("should not allow a collaborator to delete a sheet", async () => {
      // Mock authenticate middleware to simulate a collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: collaborator.id };
        next();
      });

      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Only the owner can delete sheets",
      });

      // Verify that the sheet still exists
      const existingSheet = await Sheet.findByPk(sheet.id);
      expect(existingSheet).not.toBeNull();
    });

    it("should not allow non-collaborator to delete a sheet", async () => {
      // Mock authenticate middleware to simulate a non-collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: nonCollaborator.id };
        next();
      });

      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${sheet.id}`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Only the owner can delete sheets",
      });

      const existingSheet = await Sheet.findByPk(sheet.id);
      expect(existingSheet).not.toBeNull();
    });

    it("should return 404 when trying to delete a non-existent sheet", async () => {
      const nonExistentSheetId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${nonExistentSheetId}`
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Sheet not found" });
    });

    // ... Additional DELETE tests as shown earlier ...
  });
  describe("Authorization Scenarios", () => {
    let collaboratorSheet;
    let nonCollaboratorSheet;

    beforeEach(async () => {
      collaboratorSheet = await Sheet.create({
        id: uuidv4(),
        spreadsheetId: spreadsheet.id,
        name: "Collaborator's Sheet",
      });

      nonCollaboratorSheet = await Sheet.create({
        id: uuidv4(),
        spreadsheetId: spreadsheet.id,
        name: "Non-Collaborator's Sheet",
      });

      // Add collaborator to spreadsheet
      await spreadsheet.addCollaborator(collaborator.id);
    });

    it("should allow owner to delete a sheet", async () => {
      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${collaboratorSheet.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Sheet deleted successfully" });

      const deletedSheet = await Sheet.findByPk(collaboratorSheet.id);
      expect(deletedSheet).toBeNull();
    });

    it("should not allow collaborator to delete a sheet", async () => {
      // Mock authenticate middleware to simulate collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: collaborator.id };
        next();
      });

      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${collaboratorSheet.id}`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Only the owner can delete sheets",
      });

      const existingSheet = await Sheet.findByPk(collaboratorSheet.id);
      expect(existingSheet).not.toBeNull();
    });

    it("should not allow non-collaborator to delete a sheet", async () => {
      // Mock authenticate middleware to simulate non-collaborator
      authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: nonCollaborator.id };
        next();
      });

      const response = await request(app).delete(
        `/spreadsheets/${spreadsheet.id}/sheets/${nonCollaboratorSheet.id}`
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Only the owner can delete sheets",
      });

      const existingSheet = await Sheet.findByPk(nonCollaboratorSheet.id);
      expect(existingSheet).not.toBeNull();
    });
  });
});
