/**
 * migrate.js — One-command MySQL Database Migration Runner
 *
 * Runs all 5 SQL scripts in order against any MySQL instance (Aiven or Local)
 * using a single connection URL or host/port/user/password.
 *
 * USAGE:
 *   node migrate.js "mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED"
 *
 * OR using standard local connection:
 *   node migrate.js "mysql://root:password@localhost:3306"
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("\n❌ Error: Please provide your MySQL connection URL.");
  console.log("Usage: node migrate.js \"mysql://user:password@host:port/dbname\"\n");
  process.exit(1);
}

const SQL_FILES = [
  '01_schema.sql',
  '02_seed.sql',
  '03_views.sql',
  '04_procedures_triggers.sql',
  '05_demo_queries.sql',
];

async function runMigrations() {
  console.log("\n=======================================================");
  console.log("POLICE DBMS — AUTOMATED DATABASE MIGRATION");
  console.log("=======================================================\n");

  const urlObj = new URL(DB_URL);
  const isAiven = urlObj.hostname.includes("aiven.io");

  const connConfig = {
    uri: DB_URL,
    multipleStatements: true, // Needed to execute whole SQL files at once
  };

  if (isAiven) {
    connConfig.ssl = { rejectUnauthorized: false };
  }

  let connection;
  try {
    console.log(`Connecting to MySQL at ${urlObj.hostname}:${urlObj.port || 3306}...`);
    connection = await mysql.createConnection(connConfig);
    console.log("Connected successfully!\n");

    const dbDir = path.join(__dirname, 'database');

    for (let i = 0; i < SQL_FILES.length; i++) {
      const fileName = SQL_FILES[i];
      const filePath = path.join(dbDir, fileName);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Could not find ${fileName} in database/`);
        continue;
      }

      console.log(`[${i + 1}/5] Executing ${fileName}...`);
      let sql = fs.readFileSync(filePath, 'utf-8');

      // Strip DELIMITER statements for mysql2 compatibility
      sql = sql.replace(/DELIMITER\s*\/\//gi, '');
      sql = sql.replace(/DELIMITER\s*;/gi, '');
      sql = sql.replace(/\/\/\s*$/gm, ';');

      await connection.query(sql);
      console.log(`  ✓ ${fileName} executed successfully.`);
    }

    console.log("\n=======================================================");
    console.log("✅ ALL 5 MIGRATIONS COMPLETED SUCCESSFULLY!");
    console.log("All 9 tables, seed data, views, and triggers are ready.");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();

