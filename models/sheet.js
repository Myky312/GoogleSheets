// models/sheet.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Sheet extends Model {
    static associate(models) {
      // Belongs to Spreadsheet
      Sheet.belongsTo(models.Spreadsheet, {
        foreignKey: "spreadsheetId",
        as: "Spreadsheet",
        onDelete: "CASCADE",
      });

      // One-to-Many: Sheet -> Cells
      Sheet.hasMany(models.Cell, {
        foreignKey: "sheetId",
        as: "Cells",
        onDelete: "CASCADE",
      });
    }
  }

  Sheet.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      spreadsheetId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Spreadsheets",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      name: {
        type: DataTypes.STRING,
        defaultValue: "Sheet1",
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Sheet",
      tableName: "Sheets",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["spreadsheetId", "name"],
        },
      ],
    }
  );

  return Sheet;
};
