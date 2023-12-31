const app = require('./src/app');
const sequelize = require('./src/config/database');
const TokenService = require('./src/auth/TokenService');
const logger = require('./src/logger');

async function startServer() {
  // Sync database
  await sequelize.sync();
  // cleanup expired tokens
  await TokenService.scheduledCleanup();
  // Start app
  app.listen(process.env.PORT || 3000, () => {
    logger.info('App running version ' + process.env.npm_package_version);
  });
}
startServer();
