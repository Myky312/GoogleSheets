// config/config.js

// Load environment variables based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: '.env.test' });
} else {
  require('dotenv').config(); // loads ".env" by default
}

const isDocker = process.env.DOCKER_ENV === 'true';

let databaseUrl;
let testDatabaseUrl;

// Determine the appropriate database URL based on the environment and Docker
if (process.env.NODE_ENV === 'test') {
  databaseUrl = isDocker
    ? process.env.TEST_DATABASE_URL_DOCKER
    : process.env.TEST_DATABASE_URL_LOCAL;
} else {
  // development or production
  databaseUrl = isDocker
    ? process.env.DATABASE_URL_DOCKER
    : process.env.DATABASE_URL_LOCAL;
}

// Only set testDatabaseUrl if in test mode
testDatabaseUrl = isDocker
  ? process.env.TEST_DATABASE_URL_DOCKER
  : process.env.TEST_DATABASE_URL_LOCAL;

const config = {
  development: {
    url: databaseUrl,
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    logging: console.log,
  },
  test: {
    url: testDatabaseUrl,
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
  },
};

module.exports = config;
