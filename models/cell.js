// models/cell.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Cell extends Model {
    static associate(models) {
      Cell.belongsTo(models.Sheet, { foreignKey: 'sheetId' });
    }
  }

  Cell.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sheetId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      row: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      column: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
      },
      formula: {
        type: DataTypes.TEXT,
      },
      hyperlink: {
        type: DataTypes.TEXT,
      }
    },
    {
      sequelize,
      modelName: 'Cell',
      tableName: 'Cells',
      timestamps: true,
    }
  );

  return Cell;
};
