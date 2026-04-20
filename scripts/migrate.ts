import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const pool = new Pool({ connectionString: url });

  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (id int PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);

  const files = readdirSync(join(process.cwd(), 'drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const id = Number(file.split('_')[0]);
    if (!Number.isFinite(id)) continue;
    const { rowCount } = await pool.query('SELECT 1 FROM _migrations WHERE id=$1', [id]);
    if (rowCount) {
      console.log(`[migrate] skip ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(process.cwd(), 'drizzle', file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (id, name) VALUES ($1, $2)', [id, file]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }

  await pool.end();
  console.log('[migrate] done');
}

main().catch((err) => { console.error(err); process.exit(1); });
