// models/userSpreadsheet.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserSpreadsheet extends Model {
    static associate(models) {
      // Define any associations if necessary
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
      },
      spreadsheetId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Spreadsheets", // Ensure this matches your table name
          key: "id",
        },
      },      
      // Add any additional fields here
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
