/**
 * Idempotent migration runner. Applies any .sql file in ./migrations that
 * hasn't been recorded in the schema_migrations table. Each migration runs
 * in its own transaction.
 *
 * Invoked from the deploy pipeline as:
 *   docker compose run --rm api node migrate.js
 *
 * Safe to run repeatedly — it no-ops if everything is already applied.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.join(__dirname, 'migrations');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(MIG_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let applied = 0;
  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rows.length) {
      console.log(`-- skip ${file} (already applied)`);
      continue;
    }
    const sql = await fs.readFile(path.join(MIG_DIR, file), 'utf8');
    console.log(`==> applying ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  console.log(`migrations complete (${applied} applied, ${files.length - applied} skipped)`);
} finally {
  await client.end();
}
