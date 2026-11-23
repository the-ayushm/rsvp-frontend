import 'dotenv/config';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public';
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO "${schema.replaceAll('"', '""')}"`);
    await client.query(await readFile(new URL('./facebook.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
    console.log('Facebook Lead Ads tables are ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
