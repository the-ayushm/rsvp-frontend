import 'dotenv/config';
import { Pool, types } from 'pg';
import { createDatabase, type Database, type TransactionClient } from './client';
import type { SqlPool } from './types';
import { parseUtcTimestamp } from './timestamps';

const globalDatabase = globalThis as unknown as { soft7Database?: Database };
// Existing TIMESTAMP columns store UTC without a timezone suffix.
types.setTypeParser(1114, parseUtcTimestamp);

function createProductionDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // No connection is attempted during compilation/import. Requests fail clearly.
    const unavailable = async (): Promise<never> => { throw new Error('DATABASE_URL is required for local backend database operations.'); };
    const pool: SqlPool = { query: unavailable, connect: unavailable, end: async () => {} };
    return createDatabase(pool, 'public', pool);
  }
  const schema = new URL(connectionString).searchParams.get('schema') || 'public';
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, options: '-c timezone=UTC' });
  // Idle socket failures must not become uncaught exceptions in long-lived workers.
  pool.on('error', (error) => console.error('[Database] Idle PostgreSQL connection failed:', error.message));
  return createDatabase(pool as unknown as SqlPool, schema, pool as unknown as SqlPool);
}

export const database = globalDatabase.soft7Database ?? createProductionDatabase();
if (process.env.NODE_ENV !== 'production') globalDatabase.soft7Database = database;
export type { Database, TransactionClient };
export { UserStatus } from './records';
export type { JsonValue, JsonObject } from './records';
