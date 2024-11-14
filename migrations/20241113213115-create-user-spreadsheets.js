// migrations/20241113213115-create-user-spreadsheets.js

"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("UserSpreadsheets", {
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        primaryKey: true,
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      spreadsheetId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Spreadsheets",
          key: "id",
        },
        primaryKey: true,
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      // Removed 'role' field
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("UserSpreadsheets");
  },
};
