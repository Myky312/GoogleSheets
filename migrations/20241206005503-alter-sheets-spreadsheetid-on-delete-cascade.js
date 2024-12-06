"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraint
    await queryInterface.removeConstraint(
      "Sheets",
      "Sheets_spreadsheetId_fkey"
    );

    // Add a new foreign key constraint with ON DELETE CASCADE
    await queryInterface.addConstraint("Sheets", {
      fields: ["spreadsheetId"],
      type: "foreign key",
      name: "Sheets_spreadsheetId_fkey", // Ensure this matches the existing constraint name
      references: {
        table: "Spreadsheets",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the foreign key constraint with ON DELETE CASCADE
    await queryInterface.removeConstraint(
      "Sheets",
      "Sheets_spreadsheetId_fkey"
    );

    // Re-add the original foreign key constraint without ON DELETE CASCADE
    await queryInterface.addConstraint("Sheets", {
      fields: ["spreadsheetId"],
      type: "foreign key",
      name: "Sheets_spreadsheetId_fkey",
      references: {
        table: "Spreadsheets",
        field: "id",
      },
      onDelete: "NO ACTION",
      onUpdate: "CASCADE",
    });
  },
};
