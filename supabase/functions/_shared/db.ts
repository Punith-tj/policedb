/**
 * _shared/db.ts — MySQL Database Connection
 *
 * Creates a single MySQL connection using npm:mysql2/promise.
 * Reads credentials from Supabase secrets (environment variables).
 * Supports SSL/TLS (required by Aiven).
 *
 * WHY mysql2?
 *   - Handles MySQL 8's caching_sha2_password auth natively.
 *   - Promise API works cleanly with async/await in Deno.
 *   - Supports parameterized queries out of the box.
 *
 * USAGE:
 *   const conn = await getConnection();
 *   try {
 *     const [rows] = await conn.execute("SELECT ...", [param]);
 *   } finally {
 *     await conn.end(); // ALWAYS close in finally
 *   }
 */

import mysql from "npm:mysql2@3/promise";

/**
 * Creates and returns a new MySQL connection.
 * Opens ONE connection per request — caller MUST close it in a finally block.
 *
 * Credentials come from Supabase secrets:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
 *   MYSQL_CA_CERT (optional, base64-encoded Aiven CA certificate)
 */
export async function getConnection() {
  // Read credentials from environment variables (set via `supabase secrets set`)
  const host     = Deno.env.get("MYSQL_HOST");
  const port     = parseInt(Deno.env.get("MYSQL_PORT") || "3306", 10);
  const user     = Deno.env.get("MYSQL_USER");
  const password = Deno.env.get("MYSQL_PASSWORD");
  const database = Deno.env.get("MYSQL_DB");

  // Validate that all required credentials are present
  if (!host || !user || !password || !database) {
    throw new Error(
      "Missing MySQL credentials. Set MYSQL_HOST, MYSQL_PORT, MYSQL_USER, " +
      "MYSQL_PASSWORD, MYSQL_DB via `supabase secrets set`."
    );
  }

  // Build SSL options.
  // Aiven REQUIRES SSL. If the CA certificate is provided (base64-encoded),
  // we decode it and verify the server certificate. Otherwise, we still
  // encrypt the connection but skip CA verification.
  const caCertBase64 = Deno.env.get("MYSQL_CA_CERT");
  const sslConfig: Record<string, unknown> = {};

  if (caCertBase64) {
    // Decode the base64-encoded PEM certificate
    sslConfig.ca = atob(caCertBase64);
    sslConfig.rejectUnauthorized = true;   // Full verification
  } else {
    // Still encrypted, just no CA verification (OK for development)
    sslConfig.rejectUnauthorized = false;
  }

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      ssl: sslConfig,
      connectTimeout: 10000,  // 10 seconds — Edge Functions are short-lived
      decimalNumbers: true,   // Return numbers, not strings for decimals
    });

    return connection;
  } catch (_error) {
    // NEVER expose credentials or connection details in error messages
    console.error("MySQL connection failed:", (_error as Error).message);
    throw new Error("Database connection failed. Check server configuration.");
  }
}

