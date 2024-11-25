// models/user.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // Many-to-Many: Users <-> Spreadsheets
      User.belongsToMany(models.Spreadsheet, {
        through: models.UserSpreadsheet,
        foreignKey: "userId",
        as: "CollaboratingSpreadsheets",
      });
      User.hasMany(models.Spreadsheet, {
        foreignKey: "ownerId",
        as: "OwnedSpreadsheets",
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      refreshToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "Users",
      timestamps: true,
    }
  );

  return User;
};
