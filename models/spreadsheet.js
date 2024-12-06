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

      // Many-to-Many: Spreadsheet <-> Users (Collaborators)
      Spreadsheet.belongsToMany(models.User, {
        through: models.UserSpreadsheet,
        foreignKey: "spreadsheetId",
        otherKey: "userId",
        as: "Collaborators",
        onDelete: "CASCADE",
      });

      // Belongs to Owner (User)
      Spreadsheet.belongsTo(models.User, {
        foreignKey: "ownerId",
        as: "Owner",
        onDelete: "CASCADE",
      });
    }

    /**
     * Checks if a user is a collaborator on the spreadsheet
     * @param {string} userId - UUID of the user
     * @returns {Promise<boolean>}
     */
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
        references: {
          model: "Users",
          key: "id",
        },
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
