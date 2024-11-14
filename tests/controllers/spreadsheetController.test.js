const spreadsheetController = require("../../controllers/spreadsheetController");
const { Spreadsheet, Sheet, User, UserSpreadsheet } = require("../../models");
const { getIO } = require("../../socket");
const { validationResult } = require("express-validator");

// Mock Sequelize Models
jest.mock("../../models", () => {
  const SequelizeMock = require("sequelize-mock");
  const dbMock = new SequelizeMock();

  const Spreadsheet = dbMock.define("Spreadsheet", {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test Spreadsheet",
    ownerId: "owner-id-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const Sheet = dbMock.define("Sheet", {
    id: "sheet-id-123",
    spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Sheet1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const User = dbMock.define("User", {
    id: "user-id-123",
    username: "testuser",
    email: "testuser@example.com",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const UserSpreadsheet = dbMock.define("UserSpreadsheet", {
    userId: "user-id-123",
    spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { Spreadsheet, Sheet, User, UserSpreadsheet };
});

// Mock getIO function
jest.mock("../../socket", () => ({
  getIO: jest.fn(),
}));

jest.mock("../../models/userSpreadsheet", () => ({
  findOne: jest.fn(),
  destroy: jest.fn(),
}));

// Mock validationResult function from express-validator
jest.mock("express-validator", () => ({
  ...jest.requireActual("express-validator"),
  validationResult: jest.fn(),
}));

describe("Spreadsheet Controller", () => {
  let req, res, next;
  let mockSpreadsheet, mockSheet;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: "owner-id-123" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    mockSpreadsheet = Spreadsheet.build({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Spreadsheet",
      ownerId: "owner-id-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockSheet = Sheet.build({
      id: "sheet-id-123",
      spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Sheet1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    validationResult.mockImplementation(() => ({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([]),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSpreadsheet", () => {
    it("should create a new spreadsheet and emit event", async () => {
      req.body.name = "New Spreadsheet";

      Spreadsheet.create = jest.fn().mockResolvedValue(mockSpreadsheet);
      Sheet.create = jest.fn().mockResolvedValue(mockSheet);
      const mockEmit = jest.fn();
      getIO.mockReturnValue({ emit: mockEmit });

      await spreadsheetController.createSpreadsheet(req, res, next);

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
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ spreadsheet: mockSpreadsheet });
    });

    it("should return 400 if validation fails", async () => {
      validationResult.mockImplementationOnce(() => ({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest
          .fn()
          .mockReturnValue([{ msg: "Name is required", param: "name" }]),
      }));

      await spreadsheetController.createSpreadsheet(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Name is required", param: "name" }],
      });
      expect(Spreadsheet.create).not.toHaveBeenCalled();
      expect(Sheet.create).not.toHaveBeenCalled();
    });
    it("should handle errors and call next", async () => {
      req.body.name = "New Spreadsheet";

      // Mock `Spreadsheet.create` to simulate a database error
      const error = new Error("Database error");
      Spreadsheet.create = jest.fn().mockRejectedValue(error);

      await spreadsheetController.createSpreadsheet(req, res, next);

      // Ensure `next` was called with an Error object
      expect(next).toHaveBeenCalledWith(expect.any(Error));

      // Verify `next` was called exactly once and capture the error
      expect(next).toHaveBeenCalledTimes(1);
      const errorArg = next.mock.calls[0][0];
      //   console.log("Error passed to next:", errorArg); // Debugging

      // Verify the error message
      expect(errorArg.message).toBe("Database error");
    });
  });

  describe("deleteSpreadsheet", () => {
    it("should delete a spreadsheet and emit event", async () => {
      const mockDestroy = jest.fn().mockResolvedValue();
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";

      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        ownerId: "owner-id-123",
        destroy: mockDestroy, // Attach destroy mock
      });

      const mockEmit = jest.fn();
      getIO.mockReturnValue({ emit: mockEmit });

      // Call the deleteSpreadsheet function
      await spreadsheetController.deleteSpreadsheet(req, res, next);

      // Debugging output to ensure findByPk returns correctly
      //   console.log(
      //     "Spreadsheet.findByPk result:",
      //     await Spreadsheet.findByPk(req.params.id)
      //   );

      // Ensure findByPk was called with correct ID
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );

      // Confirm destroy was called on the spreadsheet object
      expect(mockDestroy).toHaveBeenCalled();

      // Confirm the emit function was called with the correct event
      expect(mockEmit).toHaveBeenCalledWith("spreadsheetDeleted", {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
      });

      // Confirm response status and message
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet deleted successfully",
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params.id = "non-existent-id";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(null);

      await spreadsheetController.deleteSpreadsheet(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
      //   expect(mockSpreadsheet.destroy).not.toHaveBeenCalled();
    });

    it("should return 403 if user is not the owner", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.user.id = "different-owner-id";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(mockSpreadsheet);

      await spreadsheetController.deleteSpreadsheet(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can delete the spreadsheet",
      });
      //   expect(mockSpreadsheet.destroy).not.toHaveBeenCalled();
    });

    it("should handle errors and call next", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      Spreadsheet.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.deleteSpreadsheet(req, res, next);

      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });

  describe("addCollaborator", () => {
    let req, res, next;
    let mockSpreadsheet;

    beforeEach(() => {
      req = {
        body: {},
        params: {},
        user: { id: "owner-id-123" },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();

      mockSpreadsheet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Spreadsheet",
        ownerId: "owner-id-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        Collaborators: [],
      };

      jest.clearAllMocks();
    });

    it("should add a collaborator and emit event", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorEmail = "collab@example.com";

      const collaborator = User.build({
        id: "collab-id-456",
        username: "collaborator",
        email: "collab@example.com",
      });

      Spreadsheet.findByPk = jest.fn().mockResolvedValue(mockSpreadsheet);
      User.findOne = jest.fn().mockResolvedValue(collaborator);
      UserSpreadsheet.findOne = jest.fn().mockResolvedValue(null);
      UserSpreadsheet.create = jest.fn().mockResolvedValue();

      const mockEmit = jest.fn();
      getIO.mockReturnValue({ to: () => ({ emit: mockEmit }) });

      await spreadsheetController.addCollaborator(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [{ model: User, as: "Collaborators" }],
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
      expect(mockEmit).toHaveBeenCalledWith("collaboratorAdded", {
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        collaborator: collaborator,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Collaborator added successfully",
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params.id = "non-existent-id";
      req.body.collaboratorEmail = "collab@example.com";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(null);

      await spreadsheetController.addCollaborator(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id", {
        include: [{ model: User, as: "Collaborators" }],
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("should return 403 if user is not the owner", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.user.id = "different-owner-id";
      req.body.collaboratorEmail = "collab@example.com";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      await spreadsheetController.addCollaborator(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [{ model: User, as: "Collaborators" }],
        }
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can add collaborators",
      });
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("should return 404 if collaborator not found", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorEmail = "nonexistent@example.com";

      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      User.findOne = jest.fn().mockResolvedValue(null);

      await spreadsheetController.addCollaborator(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: "nonexistent@example.com" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Collaborator not found",
      });
    });

    it("should return 400 if user is already a collaborator", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorEmail = "collab@example.com";

      const mockCollaborator = User.build({
        id: "collab-id-456",
        username: "collaborator",
        email: "collab@example.com",
      });

      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      User.findOne = jest.fn().mockResolvedValue(mockCollaborator);
      UserSpreadsheet.findOne = jest.fn().mockResolvedValue({
        spreadsheetId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "collab-id-456",
      });

      await spreadsheetController.addCollaborator(req, res, next);

      expect(UserSpreadsheet.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "User is already a collaborator",
      });
    });

    it("should handle errors and call next", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorEmail = "collab@example.com";
      Spreadsheet.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.addCollaborator(req, res, next);

      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });

  describe("removeCollaborator", () => {
    it("should remove a collaborator and emit event", async () => {
      const req = {
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
        body: { collaboratorId: "660e8400-e29b-41d4-a716-446655440111" },
        user: { id: "user-id-123" },
      };

      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock the findOne method to return a valid collaborator relationship with a destroy method
      const collaboratorMock = {
        destroy: jest.fn(), // Mock the destroy method
      };

      const findOneMock = jest
        .spyOn(UserSpreadsheet, "findOne")
        .mockResolvedValue(collaboratorMock); // Ensure it returns the mock object with destroy method

      // Mock the getIO method to return a mock socket connection
      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      getIO.mockReturnValue(io); // Mock the socket.io connection

      // Mock the Spreadsheet findByPk method to return a valid spreadsheet with correct owner
      const mockSpreadsheet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        ownerId: "user-id-123",
      };

      Spreadsheet.findByPk = jest.fn().mockResolvedValue(mockSpreadsheet);

      await spreadsheetController.removeCollaborator(req, res, next);

      // Check if the findOne mock was called with the correct arguments
      expect(findOneMock).toHaveBeenCalledWith({
        where: {
          spreadsheetId: req.params.id,
          userId: req.body.collaboratorId, // Ensure this matches the request body
        },
      });

      // Check if destroy was called on the collaborator
      expect(collaboratorMock.destroy).toHaveBeenCalled(); // Check if destroy was called on the collaborator

      // Check if the event was emitted
      expect(io.to).toHaveBeenCalledWith(req.params.id);
      expect(io.emit).toHaveBeenCalledWith("collaboratorRemoved", {
        spreadsheetId: req.params.id,
        collaboratorId: req.body.collaboratorId,
      });

      // Check if response was called
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Collaborator removed successfully",
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params.id = "non-existent-id";
      req.body.collaboratorId = "collab-id-456";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(null);

      await spreadsheetController.removeCollaborator(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id", {
        include: [{ model: User, as: "Collaborators" }],
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 403 if user is not the owner", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.user.id = "different-owner-id";
      req.body.collaboratorId = "collab-id-456";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [User.build({ id: "collab-id-456" })],
      });

      await spreadsheetController.removeCollaborator(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [{ model: User, as: "Collaborators" }],
        }
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can remove collaborators",
      });
      expect(UserSpreadsheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 400 if trying to remove the owner", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorId = "owner-id-123"; // Trying to remove the owner

      // Mocking the Spreadsheet.findByPk to return a spreadsheet where the ownerId is 'owner-id-123'
      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000", // Spreadsheet ID
        ownerId: "owner-id-123", // Owner ID should be the same as collaboratorId
        name: "Test Spreadsheet",
        Collaborators: [User.build({ id: "owner-id-123" })], // Owner is in the collaborators list
      });

      await spreadsheetController.removeCollaborator(req, res, next);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400); // Expecting 400 for owner removal
      expect(res.json).toHaveBeenCalledWith({
        message: "Owner cannot be removed as a collaborator",
      });

      // Ensure no DB call is made to UserSpreadsheet.findOne
      expect(UserSpreadsheet.findOne).not.toHaveBeenCalled();
    });

    it("should return 404 if collaborator relationship not found", async () => {
      const req = {
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
        body: { collaboratorId: "non-existent-collaborator" },
        user: { id: "owner-id-123" }, // Add user mock if needed (ensure it's the owner)
      };

      // Mock the Spreadsheet.findByPk to simulate a valid spreadsheet and its collaborators
      const mockSpreadsheet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        ownerId: "owner-id-123", // Make sure the user is the owner
        Collaborators: [{ id: "collab-id-123" }, { id: "collab-id-456" }],
      };

      // Spy on UserSpreadsheet.findOne to simulate no collaborator relationship
      const findOneMock = jest
        .spyOn(UserSpreadsheet, "findOne")
        .mockResolvedValue(null); // Simulate no relationship found

      // Mock Spreadsheet.findByPk to return the spreadsheet data
      jest.spyOn(Spreadsheet, "findByPk").mockResolvedValue(mockSpreadsheet);

      // Mock the response object
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Call the controller
      await spreadsheetController.removeCollaborator(req, res, next);

      // Check the status and response message
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Collaborator not found", // Updated to match the actual message returned by the controller
      });

      // Ensure that UserSpreadsheet.findOne was called
      expect(findOneMock).toHaveBeenCalledWith({
        where: {
          spreadsheetId: req.params.id,
          userId: req.body.collaboratorId,
        },
      });

      // Ensure next is not called, as we want to handle the error in the controller itself
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle errors and call next", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.collaboratorId = "collab-id-456";
      Spreadsheet.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.removeCollaborator(req, res, next);

      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });

  describe("getSpreadsheets", () => {
    it("should return owned and collaborated spreadsheets", async () => {
      Spreadsheet.findAll = jest.fn().mockResolvedValue([mockSpreadsheet]);
      UserSpreadsheet.findAll = jest.fn().mockResolvedValue([
        {
          Spreadsheet: Spreadsheet.build({
            id: "collab-spreadsheet-id",
            name: "Collaborated Spreadsheet",
            ownerId: "other-owner-id",
            createdAt: new Date(),
            updatedAt: new Date(),
            Sheets: [Sheet.build({ id: "sheet-id-456", name: "Sheet1" })],
          }),
        },
      ]);

      await spreadsheetController.getSpreadsheets(req, res, next);

      expect(Spreadsheet.findAll).toHaveBeenCalledWith({
        where: { ownerId: "owner-id-123" },
        include: [{ model: Sheet, as: "Sheets" }],
      });
      expect(UserSpreadsheet.findAll).toHaveBeenCalledWith({
        where: { userId: "owner-id-123" },
        include: [
          {
            model: Spreadsheet,
            as: "Spreadsheet",
            include: [{ model: Sheet, as: "Sheets" }],
          },
        ],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        ownedSpreadsheets: [mockSpreadsheet],
        collaboratedSpreadsheets: [
          Spreadsheet.build({
            id: "collab-spreadsheet-id",
            name: "Collaborated Spreadsheet",
            ownerId: "other-owner-id",
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            Sheets: [Sheet.build({ id: "sheet-id-456", name: "Sheet1" })],
          }),
        ],
      });
    });

    it("should handle errors and call next", async () => {
      Spreadsheet.findAll = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.getSpreadsheets(req, res, next);

      expect(Spreadsheet.findAll).toHaveBeenCalledWith({
        where: { ownerId: "owner-id-123" },
        include: [{ model: Sheet, as: "Sheets" }],
      });
      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });

  describe("getSpreadsheetById", () => {
    it("should return the spreadsheet if user has access", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.user.id = "owner-id-123";

      // Mocking a Sequelize instance structure
      const mockSequelizeSpreadsheet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Spreadsheet",
        ownerId: "owner-id-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        Collaborators: [{ id: "owner-id-123" }],
      };

      Spreadsheet.findByPk = jest
        .fn()
        .mockResolvedValue(mockSequelizeSpreadsheet);

      await spreadsheetController.getSpreadsheetById(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: Sheet, as: "Sheets" },
            { model: User, as: "Collaborators" },
          ],
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);

      // Match the structure without dataValues
      expect(res.json).toHaveBeenCalledWith({
        spreadsheet: mockSequelizeSpreadsheet,
      });
    });

    it("should return 403 if user does not have access", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.user.id = "unauthorized-user-id";

      Spreadsheet.findByPk = jest.fn().mockResolvedValue({
        ...mockSpreadsheet,
        Collaborators: [],
      });

      await spreadsheetController.getSpreadsheetById(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: Sheet, as: "Sheets" },
            { model: User, as: "Collaborators" },
          ],
        }
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params.id = "non-existent-id";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(null);

      await spreadsheetController.getSpreadsheetById(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id", {
        include: [
          { model: Sheet, as: "Sheets" },
          { model: User, as: "Collaborators" },
        ],
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should handle errors and call next", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      Spreadsheet.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.getSpreadsheetById(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          include: [
            { model: Sheet, as: "Sheets" },
            { model: User, as: "Collaborators" },
          ],
        }
      );
      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });

  describe("updateSpreadsheet", () => {
    it("should update the spreadsheet name and emit event", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.name = "Updated Spreadsheet";
      req.user.id = "owner-id-123";

      // Mocking a spreadsheet object with a mocked save method
      const mockSave = jest.fn().mockResolvedValue();

      // Define mockSpreadsheet after mockSave to avoid circular reference
      const mockSpreadsheet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Spreadsheet",
        ownerId: "owner-id-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        save: mockSave, // Assigning the mocked save function here
      };

      // Mocking the return value of findByPk
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(mockSpreadsheet);

      const mockEmit = jest.fn();
      getIO.mockReturnValue({ to: () => ({ emit: mockEmit }) });

      // Mocking validationResult to return no errors
      jest.spyOn(validationResult, "mockImplementation").mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });

      await spreadsheetController.updateSpreadsheet(req, res, next);

      // Expect findByPk to have been called with the correct ID
      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );

      // Expect save to be called on the spreadsheet
      expect(mockSave).toHaveBeenCalled();

      // Expect the event to be emitted
      expect(mockEmit).toHaveBeenCalledWith("spreadsheetUpdated", {
        spreadsheet: expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Updated Spreadsheet",
          ownerId: "owner-id-123",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });

      // Expect status and response to be correct
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        spreadsheet: { ...mockSpreadsheet, name: "Updated Spreadsheet" },
      });
    });

    it("should return 404 if spreadsheet not found", async () => {
      req.params.id = "non-existent-id";
      req.body.name = "Updated Spreadsheet";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(null);

      await spreadsheetController.updateSpreadsheet(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith("non-existent-id");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Spreadsheet not found",
      });
    });

    it("should return 403 if user is not the owner", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.name = "Updated Spreadsheet";
      req.user.id = "different-owner-id";
      Spreadsheet.findByPk = jest.fn().mockResolvedValue(mockSpreadsheet);

      await spreadsheetController.updateSpreadsheet(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Only owner can update the spreadsheet",
      });
    });

    it("should return 400 if validation fails", async () => {
      // Mock validationResult to return validation errors
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false), // Simulate validation failure
        array: jest
          .fn()
          .mockReturnValue([{ msg: "Name cannot be empty", param: "name" }]), // Simulate specific error
      });

      // Call the controller method
      await spreadsheetController.updateSpreadsheet(req, res, next);

      // Assert that the response status is 400
      expect(res.status).toHaveBeenCalledWith(400);

      // Assert that the error response contains the validation error message
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Name cannot be empty", param: "name" }],
      });

      // Ensure that the Spreadsheet.findByPk method was NOT called because validation failed
      expect(Spreadsheet.findByPk).not.toHaveBeenCalled();
    });

    it("should handle errors and call next", async () => {
      req.params.id = "550e8400-e29b-41d4-a716-446655440000";
      req.body.name = "Updated Spreadsheet";
      Spreadsheet.findByPk = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await spreadsheetController.updateSpreadsheet(req, res, next);

      expect(Spreadsheet.findByPk).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(next).toHaveBeenCalledWith(new Error("Database error"));
    });
  });
});
