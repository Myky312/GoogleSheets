// models/user.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // One-to-Many: User (Owner) -> Spreadsheets
      User.hasMany(models.Spreadsheet, {
        foreignKey: "ownerId",
        as: "OwnedSpreadsheets",
        onDelete: "CASCADE",
      });

      // Many-to-Many: User <-> Spreadsheets (Collaborations)
      User.belongsToMany(models.Spreadsheet, {
        through: models.UserSpreadsheet,
        foreignKey: "userId",
        otherKey: "spreadsheetId",
        as: "Collaborations",
        onDelete: "CASCADE",
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
        validate: {
          isEmail: true,
        },
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
