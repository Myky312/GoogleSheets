// testAssociations.js
const db = require("./models");

async function testAssociations() {
  try {
    await db.sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync all models (use { force: true } cautiously, as it drops tables)
    // await db.sequelize.sync({ force: true });

    // Fetch a user and include their owned spreadsheets and collaborations
    const user = await db.User.findOne({
      where: { username: "Myktybek" }, // Replace with an existing username
      include: [
        {
          model: db.Spreadsheet,
          as: "OwnedSpreadsheets",
          include: [{ model: db.Sheet, as: "Sheets" }],
        },
        {
          model: db.Spreadsheet,
          as: "Collaborations",
          include: [{ model: db.Sheet, as: "Sheets" }],
        },
      ],
    });

    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    console.error("Error testing associations:", error);
  } finally {
    await db.sequelize.close();
  }
}

testAssociations();
