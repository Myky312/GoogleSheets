// models/userSpreadsheet.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserSpreadsheet extends Model {
    static associate(models) {
      // Belongs to User
      UserSpreadsheet.belongsTo(models.User, {
        foreignKey: "userId",
        as: "User",
        onDelete: "CASCADE",
      });

      // Belongs to Spreadsheet
      UserSpreadsheet.belongsTo(models.Spreadsheet, {
        foreignKey: "spreadsheetId",
        as: "Spreadsheet",
        onDelete: "CASCADE",
      });
    }
  }

  UserSpreadsheet.init(
    {
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Users", // Ensure this matches your table name
          key: "id",
        },
        onDelete: "CASCADE",
      },
      spreadsheetId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Spreadsheets", // Ensure this matches your table name
          key: "id",
        },
        onDelete: "CASCADE",
      },
      // Add any additional fields here if needed
    },
    {
      sequelize,
      modelName: "UserSpreadsheet",
      tableName: "UserSpreadsheets", // Consistent naming
      timestamps: true, // If you want to track creation/update times
    }
  );

  return UserSpreadsheet;
};
