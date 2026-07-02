const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'notifications.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const database = new DatabaseSync(DB_PATH);
database.exec('PRAGMA journal_mode = WAL;');
database.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
database.exec(schema);

const db = {
  prepare(sql) {
    const stmt = database.prepare(sql);
    return {
      run: (...params) => {
        const info = stmt.run(...params);
        return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  },
  transaction(fn) {
    return (...args) => {
      database.exec('BEGIN');
      try {
        const result = fn(...args);
        database.exec('COMMIT');
        return result;
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

module.exports = db;
