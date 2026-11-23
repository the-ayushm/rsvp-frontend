import 'dotenv/config';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';

// Explicit bootstrap command for a NEW database, never run during app startup.
async function setup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public';
  if (schema !== 'public') throw new Error('The baseline uses the public schema. Adapt db/schema.sql before bootstrapping a different schema.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' });
  try {
    const existing = await pool.query('SELECT COUNT(*)::integer AS count FROM information_schema.tables WHERE table_schema = $1', [schema]);
    if (existing.rows[0].count !== 0) throw new Error('Database already contains tables. Refusing to apply the empty-database baseline.');
    const sql = await readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8');
    await pool.query(sql);
    console.log('Created the local backend PostgreSQL schema.');
  } finally {
    await pool.end();
  }
}

setup().catch(error => { console.error(error.message); process.exitCode = 1; });
