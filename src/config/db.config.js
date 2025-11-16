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

  pool = mysql.createPool(dbConfig);

  return pool;
}

export function getDb() {
  if (!pool) {
    pool = initDb();
  }
  return pool;
}


