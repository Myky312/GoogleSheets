const { sequelize } = require("../models");
const logger = require("../utils/logger");

(async () => {
  try {
    await sequelize.sync({ force: true });
    logger.info("Database synchronized with `force: true` (tables dropped and recreated)");
    process.exit(0); // Exit after syncing
  } catch (error) {
    logger.error("Unable to sync the database:", error);
    process.exit(1);
  }
})();
