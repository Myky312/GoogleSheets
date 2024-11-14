// socket.js

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");
const { Spreadsheet, Sheet, User, UserSpreadsheet, Cell } = require("./models");
const formulaService = require("./services/formulaService"); // Assuming you have a formula service for cell calculations

let io;

/**
 * Initialize Socket.io with the HTTP server.
 * @param {http.Server} server - The HTTP server instance.
 * @returns {Server} - The initialized Socket.io server.
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    // cors: {
    //   origin: "http://your-frontend-domain.com", // Replace with your frontend's domain
    //   methods: ["GET", "POST"],
    //   credentials: true,
    // },
    // Optional: Increase max listeners if necessary
    // maxHttpBufferSize: 1e8,
  });

  // Middleware for authenticating socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      logger.warn("Socket authentication failed: No token provided");
      return next(new Error("Authentication error: Token required"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.warn(`Socket authentication failed: ${err.message}`);
        return next(new Error("Authentication error: Invalid token"));
      }
      socket.userId = decoded.userId;
      next();
    });
  });

  // Handle socket connections
  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    /**
     * Join a spreadsheet room.
     * This allows the user to receive real-time updates related to this spreadsheet.
     * @param {string} spreadsheetId - The ID of the spreadsheet to join.
     */
    socket.on("joinSpreadsheet", async (spreadsheetId) => {
      try {
        // Verify that the user has access to the spreadsheet
        const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
          include: [{ model: User, as: "Collaborators", attributes: ["id"] }],
        });

        if (!spreadsheet) {
          socket.emit("error", { message: "Spreadsheet not found" });
          return;
        }

        const isOwner = spreadsheet.ownerId === socket.userId;
        const isCollaborator = spreadsheet.Collaborators.some(
          (user) => user.id === socket.userId
        );

        if (!isOwner && !isCollaborator) {
          socket.emit("error", {
            message: "Access denied to join spreadsheet",
          });
          return;
        }

        // Join the room
        socket.join(spreadsheetId);
        logger.info(
          `User ${socket.userId} joined spreadsheet ${spreadsheetId}`
        );

        // Optionally, emit a user presence event
        io.to(spreadsheetId).emit("userJoined", {
          spreadsheetId,
          userId: socket.userId,
        });
      } catch (error) {
        logger.error(`Error joining spreadsheet: ${error.message}`);
        socket.emit("error", { message: "Failed to join spreadsheet" });
      }
    });

    /**
     * Leave a spreadsheet room.
     * @param {string} spreadsheetId - The ID of the spreadsheet to leave.
     */
    socket.on("leaveSpreadsheet", (spreadsheetId) => {
      socket.leave(spreadsheetId);
      logger.info(`User ${socket.userId} left spreadsheet ${spreadsheetId}`);

      // Optionally, emit a user leave event
      io.to(spreadsheetId).emit("userLeft", {
        spreadsheetId,
        userId: socket.userId,
      });
    });

    /**
     * Handle real-time cell updates.
     * Clients emit this event when a cell is updated.
     * @param {Object} data - The cell update data.
     * @param {string} data.spreadsheetId - The ID of the spreadsheet.
     * @param {Object} data.cell - The cell data.
     */
    socket.on("cellUpdate", async (data) => {
      const { spreadsheetId, cell } = data;

      try {
        // Validate spreadsheet access
        const spreadsheet = await Spreadsheet.findByPk(spreadsheetId, {
          include: [{ model: User, as: "Collaborators", attributes: ["id"] }],
        });

        if (!spreadsheet) {
          socket.emit("error", { message: "Spreadsheet not found" });
          return;
        }

        const isOwner = spreadsheet.ownerId === socket.userId;
        const isCollaborator = spreadsheet.Collaborators.some(
          (user) => user.id === socket.userId
        );

        if (!isOwner && !isCollaborator) {
          socket.emit("error", { message: "Access denied to update cells" });
          return;
        }

        // Validate cell data
        const { sheetId, row, column, content, formula, hyperlink } = cell;

        if (
          typeof sheetId !== "string" ||
          typeof row !== "number" ||
          typeof column !== "number"
        ) {
          socket.emit("error", { message: "Invalid cell data" });
          return;
        }

        // If the cell contains a formula, evaluate it
        let evaluatedContent = content;
        if (formula && formula.startsWith("=")) {
          evaluatedContent = await formulaService.evaluateFormula(
            formula.slice(1),
            spreadsheetId,
            sheetId,
            row,
            column
          );
        }

        // Update or create the cell in the database
        const [existingCell, created] = await Cell.findOrCreate({
          where: { sheetId, row, column },
          defaults: {
            content: evaluatedContent,
            formula: formula || null,
            hyperlink: hyperlink || null,
          },
        });

        if (!created) {
          existingCell.content = evaluatedContent;
          existingCell.formula = formula || existingCell.formula;
          existingCell.hyperlink = hyperlink || existingCell.hyperlink;
          await existingCell.save();
        }

        // Broadcast the cell update to other clients in the same spreadsheet room
        socket.to(spreadsheetId).emit("cellUpdated", {
          spreadsheetId,
          cell: {
            sheetId,
            row,
            column,
            content: evaluatedContent,
            formula: formula || null,
            hyperlink: hyperlink || null,
          },
        });
      } catch (error) {
        logger.error(`Error handling cellUpdate: ${error.message}`);
        socket.emit("error", { message: "Failed to update cell" });
      }
    });

    /**
     * Handle user disconnection.
     */
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${socket.userId}`);
      // Optionally, broadcast user disconnect if needed
    });
  });

  return io;
};

/**
 * Get the initialized Socket.io instance.
 * Throws an error if Socket.io has not been initialized.
 * @returns {Server} - The Socket.io server instance.
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initializeSocket, getIO };
