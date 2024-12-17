// migrations/20231217050000-create-user-spreadsheets.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UserSpreadsheets', {
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      spreadsheetId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Spreadsheets',
          key: 'id',
        },
        onDelete: 'CASCADE',
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

    // Add a unique constraint on (userId, spreadsheetId)
    await queryInterface.addConstraint('UserSpreadsheets', {
      fields: ['userId', 'spreadsheetId'],
      type: 'unique',
      name: 'unique_user_spreadsheet',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('UserSpreadsheets', 'unique_user_spreadsheet');
    await queryInterface.dropTable('UserSpreadsheets');
  },
};
