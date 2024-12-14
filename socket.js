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
const initializeSocket = (server) => {
  io = new Server(server, {
    // Если нужно настроить CORS:
    // cors: {
    //   origin: "http://your-frontend-domain.com", // Замените на адрес фронтенда
    //   methods: ["GET", "POST"],
    //   credentials: true,
    // },
  });

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

    /**
     * Обработчик "cellUpdate" — реальное обновление ячейки в реальном времени.
     * @param {object} data - { spreadsheetId, cell: {...} }
     */
    socket.on("cellUpdate", async (data) => {
      const { spreadsheetId, cell } = data;

      try {
        // Проверяем Spreadsheet и доступ
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

        // Извлекаем данные ячейки
        const { sheetId, row, column, content, formula, hyperlink } = cell;
        if (typeof sheetId !== "string" || typeof row !== "number" || typeof column !== "number") {
          socket.emit("error", { message: "Invalid cell data" });
          return;
        }

        // Проверяем, что Sheet существует
        const sheet = await Sheet.findOne({
          where: { id: sheetId, spreadsheetId },
        });
        if (!sheet) {
          socket.emit("error", { message: "Sheet not found" });
          return;
        }

        // Если есть формула, вычисляем
        let evaluatedContent = content;
        if (formula && formula.startsWith("=")) {
          const evaluationResult = await formulaService.evaluateFormula(
            formula.slice(1), // убираем "="
            { spreadsheetId, sheetId, row, column }
          );

          if (evaluationResult.error) {
            evaluatedContent = "#ERROR!";
            // Отправляем ошибку обратно только этому сокету
            socket.emit("formulaError", {
              cell: { sheetId, row, column },
              error: evaluationResult.error,
            });
          } else {
            evaluatedContent = evaluationResult.value; // предполагаем, что вернётся строка или число
          }
        }

        // Создаём или обновляем ячейку в БД
        const [existingCell, created] = await Cell.findOrCreate({
          where: { sheetId, row, column },
          defaults: {
            content: evaluatedContent,
            formula: formula || null,
            hyperlink: hyperlink || null,
          },
        });

        if (!created) {
          // обновляем, если не новая
          existingCell.content = evaluatedContent;
          existingCell.formula = formula || null;
          existingCell.hyperlink = hyperlink || null;
          await existingCell.save();
        }

        // Зависимости формул (если у вас реализован такой сервис)
        if (formula && formula.startsWith("=")) {
          await formulaService.updateDependencies(existingCell, formula.slice(1));
        } else {
          await formulaService.clearDependencies(existingCell);
        }

        // Пересчитываем зависимые ячейки (если реализация есть)
        const affectedCells = await formulaService.recalculateDependentCells(existingCell);

        // Рассылаем всем в комнате обновление ячеек
        io.to(spreadsheetId).emit("cellsUpdated", {
          spreadsheetId,
          cells: [existingCell, ...affectedCells],
        });
      } catch (error) {
        logger.error(`Error handling cellUpdate: ${error.message}`);
        socket.emit("error", { message: "Failed to update cell" });
      }
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
