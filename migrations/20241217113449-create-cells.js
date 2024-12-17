// migrations/20231217040000-create-cells.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Cells', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        allowNull: false,
        primaryKey: true,
      },
      sheetId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Sheets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      row: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      column: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      formula: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      hyperlink: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    // Add a unique constraint on (sheetId, row, column)
    await queryInterface.addConstraint('Cells', {
      fields: ['sheetId', 'row', 'column'],
      type: 'unique',
      name: 'unique_sheet_cell_position',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('Cells', 'unique_sheet_cell_position');
    await queryInterface.dropTable('Cells');
  },
};
