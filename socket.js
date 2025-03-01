// socket.js

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");
const { Spreadsheet, Sheet, User, Cell } = require("./models");
const formulaService = require("./services/formulaService"); 

let io;

/**
 * Инициализирует Socket.io поверх вашего HTTP-сервера.
 * @param {http.Server} server - Экземпляр HTTP-сервера (Express).
 * @returns {Server} - Экземпляр Socket.io.
 */
const initializeSocket = server => {
  io = new Server(server, {
    cors: {
      origin: '*', // Замените на адрес фронтенда
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  })


  // Мидлвара аутентификации по JWT при установке сокет-соединения
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
      socket.userId = decoded.userId; // Сохраняем userId в сокете
      next();
    });
  });

  // Основной обработчик событий при подключении сокета
  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    /**
     * Пользователь присоединяется к комнате spreadsheet.
     * @param {string} spreadsheetId - ID таблицы (UUID).
     */
    socket.on("joinSpreadsheet", async (spreadsheetId) => {
      try {
        // Проверяем доступ пользователя к spreadsheet
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

        // Присоединяемся к комнате spreadsheetId
        socket.join(spreadsheetId);
        logger.info(`User ${socket.userId} joined spreadsheet ${spreadsheetId}`);

        // Уведомляем всех в комнате, что пользователь присоединился
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
     * Пользователь покидает комнату spreadsheet.
     * @param {string} spreadsheetId - ID таблицы (UUID).
     */
    socket.on("leaveSpreadsheet", (spreadsheetId) => {
      socket.leave(spreadsheetId);
      logger.info(`User ${socket.userId} left spreadsheet ${spreadsheetId}`);

      io.to(spreadsheetId).emit("userLeft", {
        spreadsheetId,
        userId: socket.userId,
      });
    });

    // Событие отключения сокета
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${socket.userId}`);
      // Если нужно, можно уведомить комнату, что пользователь вышел
    });
  });

  return io;
};

/**
 * Возвращает инициализированный экземпляр Socket.io.
 * Бросает ошибку, если Socket.io не был проинициализирован.
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initializeSocket, getIO };
