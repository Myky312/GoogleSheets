// models/sheet.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Sheet extends Model {
    static associate(models) {
      Sheet.belongsTo(models.Spreadsheet, { foreignKey: 'spreadsheetId' });
      Sheet.hasMany(models.Cell, { foreignKey: 'sheetId' });
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
      },
      name: {
        type: DataTypes.STRING,
        defaultValue: 'Sheet1',
      },
    },
    {
      sequelize,
      modelName: 'Sheet',
      tableName: 'Sheets',
      timestamps: true,
    }
  );

  return Sheet;
};
