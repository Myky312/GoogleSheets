// tests/routes/spreadSheetRoutes.test.js

const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const spreadsheetRoutes = require("../../routes/spreadSheetRoutes");
const { getIO } = require("../../socket");

// Mocking Sequelize Models without using sequelize-mock
jest.mock("../../models", () => ({
  Spreadsheet: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Sheet: {
    create: jest.fn(),
    build: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  UserSpreadsheet: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

const { Spreadsheet, Sheet, User, UserSpreadsheet } = require("../../models");

// Mocking getIO function
jest.mock("../../socket", () => ({
  getIO: jest.fn(),
}));

// Mocking Authentication Middleware
const authenticate = (req, res, next) => {
  // For testing, set req.user based on test scenarios
  if (req.headers.authorization === "Bearer valid-token") {
    req.user = { id: "owner-id-123", email: "testuser@example.com" };
    next();
  } else if (req.headers.authorization === "Bearer collaborator-token") {
    req.user = { id: "collab-id-456", email: "collab@example.com" };
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Create an Express app instance for testing
const app = express();
app.use(bodyParser.json());

// Apply authentication middleware and routes
app.use("/spreadsheets", authenticate, spreadsheetRoutes);

// Error Handling Middleware for Tests
app.use((err, req, res, next) => {
  // console.log(err); // Log error for debugging
  res.status(500).json({ error: "Something went wrong!" });
});

// Mock the getIO function to prevent actual socket emissions
const mockEmit = jest.fn();
getIO.mockReturnValue({
  emit: mockEmit,
  to: () => ({ emit: jest.fn() }),
});

describe("Spreadsheet Routes", () => {
  let mockSpreadsheet, mockSheet, mockUser, mockCollaborator;

  beforeEach(() => {
    // Reset all mock implementations and calls before each test
    jest.clearAllMocks();

    // Mock Spreadsheet instance with mocked save and destroy methods
    mockSpreadsheet = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Spreadsheet",
      ownerId: "owner-id-123",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      save: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };

    // Mock Sheet instance
    mockSheet = {
      id: "sheet-id-123",
      spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Sheet1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock User instance (Owner)
    mockUser = {
      id: "owner-id-123",
      username: "testuser",
      email: "testuser@example.com",
    };

    // Mock Collaborator instance
    mockCollaborator = {
      id: "collab-id-456",
      username: "collaborator",
      email: "collab@example.com",
    };
  });

  describe("POST /spreadsheets", () => {
    it("should create a new spreadsheet", async () => {
      Spreadsheet.create.mockResolvedValue(mockSpreadsheet);
      Sheet.create.mockResolvedValue(mockSheet);

      const res = await request(app)
        .post("/spreadsheets")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "New Spreadsheet" });

      expect(Spreadsheet.create).toHaveBeenCalledWith({
        name: "New Spreadsheet",
        ownerId: "owner-id-123",
      });
      expect(Sheet.create).toHaveBeenCalledWith({
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Sheet1",
      });
      expect(mockEmit).toHaveBeenCalledWith("spreadsheetCreated", {
        spreadsheet: mockSpreadsheet,
      });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Test Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      });
    });

    it("should return 400 if name is missing", async () => {
      const res = await request(app)
        .post("/spreadsheets")
        .set("Authorization", "Bearer valid-token")
        .send({}); // Sending empty body to simulate missing name

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Spreadsheet name is required",
            path: "name", // Updated to match the actual response field
            location: "body",
            type: "field", // Added to match the actual response
          }),
        ])
      );
      expect(Spreadsheet.create).not.toHaveBeenCalled(); // Check that create wasn't called
    });

    it("should return 401 if unauthorized", async () => {
      const res = await request(app)
        .post("/spreadsheets")
        .send({ name: "New Spreadsheet" });

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
      expect(Spreadsheet.create).not.toHaveBeenCalled();
    });

    it("should handle server errors", async () => {
      Spreadsheet.create.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .post("/spreadsheets")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "New Spreadsheet" });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("GET /spreadsheets", () => {
    it("should return owned and collaborated spreadsheets", async () => {
      // Mock owned spreadsheets
      Spreadsheet.findAll.mockImplementation(({ where }) => {
        if (where && where.ownerId) {
          return Promise.resolve([mockSpreadsheet]);
        }
        return Promise.resolve([]);
      });

      // Mock collaborated spreadsheets
      Spreadsheet.findAll.mockImplementation(({ include }) => {
        if (include) {
          // Assuming include for collaborators
          return Promise.resolve([mockSpreadsheet]);
        }
        return Promise.resolve([]);
      });

      const res = await request(app)
        .get("/spreadsheets")
        .set("Authorization", "Bearer valid-token");

      expect(Spreadsheet.findAll).toHaveBeenCalledWith({
        where: { ownerId: "owner-id-123" },
        include: [{ model: Sheet, as: "Sheets" }],
      });

      // Since the second findAll call for collaborated spreadsheets is not correctly mocked,
      // let's adjust the mock to handle both calls.

      // Reset mocks and redefine them
      jest.clearAllMocks();
      Spreadsheet.findAll
        .mockImplementationOnce(() => Promise.resolve([mockSpreadsheet])) // Owned
        .mockImplementationOnce(() => Promise.resolve([])); // Collaborated

      const res2 = await request(app)
        .get("/spreadsheets")
        .set("Authorization", "Bearer valid-token");

      expect(Spreadsheet.findAll).toHaveBeenCalledTimes(2);
      expect(Spreadsheet.findAll).toHaveBeenNthCalledWith(1, {
        where: { ownerId: "owner-id-123" },
        include: [{ model: Sheet, as: "Sheets" }],
      });
      expect(Spreadsheet.findAll).toHaveBeenNthCalledWith(2, {
        include: [
          {
            model: User,
            as: "Collaborators",
            where: { id: "owner-id-123" },
            attributes: [],
            through: { attributes: [] },
          },
          {
            model: Sheet,
            as: "Sheets",
          },
        ],
        distinct: true,
      });

      expect(res2.statusCode).toBe(200);
      expect(res2.body).toEqual({
        ownedSpreadsheets: [
          expect.objectContaining({
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Test Spreadsheet",
            ownerId: "owner-id-123",
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ],
        collaboratedSpreadsheets: [],
      });
    });

    it("should return 401 if unauthorized", async () => {
      const res = await request(app).get("/spreadsheets");

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ message: "Unauthorized" });
    });

    it("should handle server errors", async () => {
      Spreadsheet.findAll.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/spreadsheets")
        .set("Authorization", "Bearer valid-token");

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("GET /spreadsheets/:id", () => {
    it("should return the spreadsheet if user is the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
        Sheets: [],
        createdAt: "2024-12-06T02:39:45.562Z",
        updatedAt: "2024-12-06T02:39:45.562Z",
      });

      const res = await request(app)
        .get("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Test Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(String), // Match any valid string
          updatedAt: expect.any(String),
          Sheets: [], // Empty array
          Collaborators: [], // Empty array
          owner: null, // No owner info since the requester is the owner
        }),
      });
    });

    it("should return the spreadsheet if user is a collaborator", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [mockCollaborator],
        Sheets: [],
        createdAt: "2024-12-06T02:39:45.568Z",
        updatedAt: "2024-12-06T02:39:45.568Z",
      });

      User.findByPk.mockResolvedValue(mockUser); // Owner info

      const res = await request(app)
        .get("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer collaborator-token");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Test Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(String), // Match any valid string
          updatedAt: expect.any(String),
          Sheets: [], // Empty array
          Collaborators: [
            {
              id: "collab-id-456",
              username: "collaborator",
              email: "collab@example.com",
            },
          ],
          owner: {
            id: "owner-id-123",
            username: "testuser",
            email: "testuser@example.com",
          },
        }),
      });
    });

    it("should return 403 if user does not have access", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      const res = await request(app)
        .get("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer collaborator-token"); // Simulating a collaborator without access

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            {
              model: Sheet,
              as: "Sheets",
              attributes: [
                "id",
                "spreadsheetId",
                "name",
                "createdAt",
                "updatedAt",
              ],
            },
            {
              model: User,
              as: "Collaborators",
              attributes: ["id", "username", "email"],
              through: { attributes: [] },
            },
          ],
          attributes: ["id", "ownerId", "name", "createdAt", "updatedAt"],
        }
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: "Access denied" });
    });

    it("should return 404 if spreadsheet not found", async () => {
      Spreadsheet.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/spreadsheets/non-existent-id")
        .set("Authorization", "Bearer valid-token");

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id", {
        include: [
          {
            model: Sheet,
            as: "Sheets",
            attributes: [
              "id",
              "spreadsheetId",
              "name",
              "createdAt",
              "updatedAt",
            ],
          },
          {
            model: User,
            as: "Collaborators",
            attributes: ["id", "username", "email"],
            through: { attributes: [] },
          },
        ],
        attributes: ["id", "ownerId", "name", "createdAt", "updatedAt"],
      });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "Spreadsheet not found" });
    });

    it("should handle server errors", async () => {
      Spreadsheet.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token");

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("PUT /spreadsheets/:id", () => {
    it("should update the spreadsheet name and emit event", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        name: "Test Spreadsheet",
        save: mockSpreadsheet.save,
      });
      mockSpreadsheet.save.mockResolvedValue();

      const mockEmitUpdate = jest.fn();
      getIO.mockReturnValue({ to: () => ({ emit: mockEmitUpdate }) });

      const res = await request(app)
        .put("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "Updated Spreadsheet" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(mockSpreadsheet.save).toHaveBeenCalled();
      expect(mockEmitUpdate).toHaveBeenCalledWith("spreadsheetUpdated", {
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Updated Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Updated Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      Spreadsheet.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .put("/spreadsheets/550e8400-e29b-41d4-a716-446655440001") // Valid UUID format
        .set("Authorization", "Bearer valid-token")
        .send({ name: "Updated Spreadsheet" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001"
      );
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "Spreadsheet not found" });
    });

    it("should return 403 if user is not the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue(mockSpreadsheet);

      const res = await request(app)
        .put("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer collaborator-token") // Simulating a collaborator
        .send({ name: "Updated Spreadsheet" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        message: "Only owner can update the spreadsheet",
      });
    });

    it("should return 400 if validation fails", async () => {
      const res = await request(app)
        .put("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "" }); // Sending an empty name to trigger validation error

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Spreadsheet name cannot be empty",
            path: "name", // Updated to match the actual response
            location: "body",
            type: "field", // Added to match the actual response
            value: "", // Ensure the value field is included
          }),
        ])
      );
    });

    it("should handle server errors", async () => {
      Spreadsheet.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .put("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "Updated Spreadsheet" });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("DELETE /spreadsheets/:id", () => {
    it("should delete a spreadsheet and emit event", async () => {
      // Inline mock for the destroy method to ensure it’s recognized
      const mockDestroy = jest.fn().mockResolvedValue();

      // Mock findByPk to return an object with a destroy method and collaborators
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        destroy: mockDestroy,
        Collaborators: [mockCollaborator],
      });

      // Mock the event emitter
      const mockEmitDelete = jest.fn();
      getIO.mockReturnValue({
        to: "owner-id-123",
        emit: mockEmitDelete,
        to: (id) => ({
          emit: id === "collab-id-456" ? mockEmitDelete : jest.fn(),
        }),
      });

      const res = await request(app)
        .delete("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token");

      // Ensure findByPk and destroy are called
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        expect.any(Object)
      );
      expect(mockDestroy).toHaveBeenCalled(); // Use the inline mock here

      // Ensure the event is emitted with the correct arguments
      expect(mockEmitDelete).toHaveBeenCalledWith("spreadsheetDeleted", {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
      });

      // Validate the response
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Spreadsheet deleted successfully" });
    });

    it("should return 404 if spreadsheet not found", async () => {
      Spreadsheet.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .delete("/spreadsheets/non-existent-id")
        .set("Authorization", "Bearer valid-token");

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id", {
        include: expect.any(Array),
      });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "Spreadsheet not found" });
    });

    it("should return 403 if user is not the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue(mockSpreadsheet);

      const res = await request(app)
        .delete("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer collaborator-token"); // Simulating a collaborator

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        expect.any(Object)
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        message: "Only the owner can delete the spreadsheet",
      });
      expect(mockSpreadsheet.destroy).not.toHaveBeenCalled();
    });

    it("should handle server errors", async () => {
      Spreadsheet.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .delete("/spreadsheets/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer valid-token");

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("POST /spreadsheets/:id/add-collaborator", () => {
    it("should prevent the owner from being added as a collaborator", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "testuser@example.com" }); // Owner's email

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        message: "Owner cannot be added as a collaborator",
      });
      expect(User.findOne).not.toHaveBeenCalled();
      expect(UserSpreadsheet.create).not.toHaveBeenCalled();
    });

    it("should add a collaborator and emit event", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      User.findOne.mockResolvedValue(mockCollaborator);
      UserSpreadsheet.findOne.mockResolvedValue(null);
      UserSpreadsheet.create.mockResolvedValue();

      const mockEmitAdd = jest.fn();
      getIO.mockReturnValue({
        to: () => ({ emit: mockEmitAdd }), // Ensure `to` returns an object with `emit`
      });

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: User, as: "Collaborators", attributes: ["id", "email"] },
          ],
        }
      );
      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: "collab@example.com" },
      });
      expect(UserSpreadsheet.findOne).toHaveBeenCalledWith({
        where: {
          spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "collab-id-456",
        },
      });
      expect(UserSpreadsheet.create).toHaveBeenCalledWith({
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "collab-id-456",
      });
      expect(mockEmitAdd).toHaveBeenCalledWith("collaboratorAdded", {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        collaborator: {
          id: "collab-id-456",
          email: "collab@example.com",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: "Collaborator added successfully" });
    });

    it("should return 404 if spreadsheet not found", async () => {
      // Mock findByPk to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      // Ensure findByPk was called with the correct parameters
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: User, as: "Collaborators", attributes: ["id", "email"] },
          ],
        }
      );

      // Verify the response
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "Spreadsheet not found" });
    });

    it("should return 403 if user is not the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer collaborator-token") // Simulating a collaborator trying to add another collaborator
        .send({ collaboratorEmail: "collab@example.com" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: User, as: "Collaborators", attributes: ["id", "email"] },
          ],
        }
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        message: "Only the owner can add collaborators",
      });
      expect(User.findOne).not.toHaveBeenCalled();
      expect(UserSpreadsheet.create).not.toHaveBeenCalled();
    });

    it("should return 404 if collaborator not found", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "nonexistent@example.com" });

      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: "nonexistent@example.com" },
      });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "Collaborator not found" });
    });

    it("should return 400 if user is already a collaborator", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [mockCollaborator],
      });

      User.findOne.mockResolvedValue(mockCollaborator);
      UserSpreadsheet.findOne.mockResolvedValue({
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "collab-id-456",
      });

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(UserSpreadsheet.create).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ message: "User is already a collaborator" });
    });

    it("should handle server errors and return 500", async () => {
      Spreadsheet.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .post(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/add-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });

  describe("DELETE /spreadsheets/:id/remove-collaborator", () => {
    it("should remove a collaborator and emit event", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [mockCollaborator],
      });

      const mockUserSpreadsheet = {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "collab-id-456",
        destroy: jest.fn().mockResolvedValue(),
      };
      UserSpreadsheet.findOne.mockResolvedValue(mockUserSpreadsheet);

      const mockEmitRemove = jest.fn();
      getIO.mockReturnValue({
        to: () => ({ emit: mockEmitRemove }), // Ensure `to` returns an object with `emit`
      });

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: User, as: "Collaborators", attributes: ["id", "email"] },
          ],
        }
      );
      expect(UserSpreadsheet.findOne).toHaveBeenCalledWith({
        where: {
          spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "collab-id-456",
        },
      });

      expect(mockUserSpreadsheet.destroy).toHaveBeenCalled();
      expect(mockEmitRemove).toHaveBeenCalledWith("collaboratorRemoved", {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        collaborator: {
          id: "collab-id-456",
          email: "collab@example.com",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Collaborator removed successfully",
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      // Mock `findByPk` to return null
      Spreadsheet.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        ) // Valid UUID format
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "test@example.com" }); // Valid email

      // Assert the status code and message
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Spreadsheet not found");
    });

    it("should return 403 if user is not the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [mockCollaborator],
      });

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        )
        .set("Authorization", "Bearer collaborator-token") // Simulating a collaborator trying to remove another collaborator
        .send({ collaboratorEmail: "collab@example.com" });

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: User, as: "Collaborators", attributes: ["id", "email"] },
          ],
        }
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        message: "Only the owner can remove collaborators",
      });
      expect(UserSpreadsheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 400 if trying to remove the owner", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [{ id: "owner-id-123", email: "testuser@example.com" }],
      });

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "testuser@example.com" }); // Owner's email

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        message: "Owner cannot be removed as a collaborator",
      });
      expect(UserSpreadsheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 404 if collaborator relationship not found", async () => {
      Spreadsheet.findByPk.mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [mockCollaborator],
      });

      UserSpreadsheet.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(UserSpreadsheet.findOne).toHaveBeenCalledWith({
        where: {
          spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "collab-id-456",
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ message: "User is not a collaborator" });
    });

    it("should handle server errors and return 500", async () => {
      Spreadsheet.findByPk.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .delete(
          "/spreadsheets/550e8400-e29b-41d4-a716-446655440000/remove-collaborator"
        )
        .set("Authorization", "Bearer valid-token")
        .send({ collaboratorEmail: "collab@example.com" });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Something went wrong!" });
    });
  });
});
