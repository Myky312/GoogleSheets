// docs/swagger.js

const swaggerJSDoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Collaborative Spreadsheet Backend API",
      version: "1.0.0",
      description:
        "API documentation for the Collaborative Spreadsheet Backend built with Node.js, Express, and Sequelize, Socket.IO.",
      contact: {
        name: "Myktybek Sattarov",
        email: "sattarovmyktybek255@gmail.com",
        url: "",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
      {
        url: "https://api.your-domain.com",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "Endpoints related to user authentication",
      },
      {
        name: "Spreadsheets",
        description: "Endpoints related to spreadsheet management",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format **Bearer <token>**",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            username: {
              type: "string",
              example: "testuser",
            },
            email: {
              type: "string",
              example: "testuser@example.com",
            },
            passwordHash: {
              type: "string",
              description: "Hashed password for the user",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token for the user",
            },
          },
          required: ["id", "username", "email", "passwordHash"],
        },
        Spreadsheet: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            ownerId: { type: "string", format: "uuid" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "ownerId", "name", "createdAt", "updatedAt"],
        },
        Sheet: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            spreadsheetId: {
              type: "string",
              format: "uuid",
            },
            name: {
              type: "string",
              example: "Sheet1",
            },
          },
          required: ["id", "spreadsheetId", "name"],
        },
        UserSpreadsheet: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            spreadsheetId: {
              type: "string",
              format: "uuid",
              example: "987e6543-e21b-12d3-a456-426614174000",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2024-11-13T22:30:00Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2024-11-14T10:15:30Z",
            },
          },
          required: ["userId", "spreadsheetId"],
        },
        Collaborator: {
          type: "object",
          properties: {
            collaboratorId: {
              type: "string",
              format: "uuid",
            },
          },
          required: ["collaboratorId"],
        },
      },
    },
  },
  apis: [path.join(__dirname, "../routes/*.js")], // Path to your route files with JSDoc comments
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
