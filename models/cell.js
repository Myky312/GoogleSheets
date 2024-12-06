// models/cell.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Cell extends Model {
    static associate(models) {
      // Belongs to Sheet
      Cell.belongsTo(models.Sheet, {
        foreignKey: "sheetId",
        as: "Sheet",
        onDelete: "CASCADE",
      });
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
        references: {
          model: "Sheets",
          key: "id",
        },
        onDelete: "CASCADE",
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
        allowNull: true,
      },
      formula: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hyperlink: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Cell",
      tableName: "Cells",
      timestamps: true,
    }
  );

  return Cell;
};
