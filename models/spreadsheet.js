// models/spreadsheet.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Spreadsheet extends Model {
    static associate(models) {
      // One-to-Many: Spreadsheet -> Sheets
      Spreadsheet.hasMany(models.Sheet, {
        foreignKey: "spreadsheetId",
        as: "Sheets",
        onDelete: "CASCADE",
      });

      // Many-to-Many: Spreadsheets <-> Users
      Spreadsheet.belongsToMany(models.User, {
        through: models.UserSpreadsheet,
        foreignKey: "spreadsheetId",
        as: "Collaborators",
      });

      // Belongs to Owner
      Spreadsheet.belongsTo(models.User, {
        foreignKey: "ownerId",
        as: "Owner",
      });
    }

    async hasCollaborator(userId) {
      const collaborators = await this.getCollaborators({
        where: { id: userId },
      });
      return collaborators.length > 0;
    }
  }

  Spreadsheet.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Spreadsheet",
      tableName: "Spreadsheets",
      timestamps: true,
    }
  );

  return Spreadsheet;
};
