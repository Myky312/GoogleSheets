// migrations/20231217030000-create-sheets.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Sheets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        allowNull: false,
        primaryKey: true,
      },
      spreadsheetId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Spreadsheets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Sheet1',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Add a unique constraint on (spreadsheetId, name)
    await queryInterface.addConstraint('Sheets', {
      fields: ['spreadsheetId', 'name'],
      type: 'unique',
      name: 'unique_spreadsheet_sheet_name',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('Sheets', 'unique_spreadsheet_sheet_name');
    await queryInterface.dropTable('Sheets');
  },
};
