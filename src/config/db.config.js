import mysql from 'mysql2/promise';
import { config as loadEnv } from 'dotenv';

loadEnv();

let pool;

export function initDb() {
  if (pool) return pool;

  // Trim whitespace from env vars to avoid issues (especially trailing spaces)
  const dbConfig = {
    host: (process.env.DB_HOST || 'localhost').trim(),
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: (process.env.DB_USER || 'root').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'itrepairhub').trim(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds timeout for connection
  };

  /**
   * Enable TLS/SSL when connecting to managed databases (e.g. TiDB Serverless)
   * that reject insecure/plaintext connections.
   *
   * - Controlled via DB_SSL env flag so localhost dev keeps working without TLS.
   * - For most managed MySQL-compatible services, an empty ssl object is
   *   enough to enable encrypted transport. If you need strict certificate
   *   verification, you can provide CA / cert paths via env and extend below.
   */
  const shouldUseSsl =
    (process.env.DB_SSL || '').trim().toLowerCase() === 'true' ||
    (process.env.DB_HOST || '').includes('tidbcloud.com');

  if (shouldUseSsl) {
    // Basic TLS - encryption without strict CA verification by default.
    // This is usually acceptable for development and many managed services.
    dbConfig.ssl = {
      minVersion: 'TLSv1.2',
    };
  }

  pool = mysql.createPool(dbConfig);

  return pool;
}

export function getDb() {
  if (!pool) {
    pool = initDb();
  }
  return pool;
}


