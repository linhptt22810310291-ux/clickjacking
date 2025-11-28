'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/database.json')[env];
const db = {};

console.log('🔧 Database config:', {
  env,
  dialect: config.dialect,
  use_env_variable: config.use_env_variable,
  hasDbUrl: !!process.env.DATABASE_URL
});

let sequelize;
try {
  if (config.use_env_variable) {
    const dbUrl = process.env[config.use_env_variable];
    console.log('🔗 Connecting with DATABASE_URL:', dbUrl ? dbUrl.substring(0, 30) + '...' : 'NOT SET');
    sequelize = new Sequelize(dbUrl, config);
  } else {
    console.log('🔗 Connecting with direct config:', config.host, config.database);
    sequelize = new Sequelize(config.database, config.username, config.password, config);
  }
} catch (error) {
  console.error('❌ Sequelize initialization error:', error.message);
  throw error;
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;