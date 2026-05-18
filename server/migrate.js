import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');

await client.connect();
try {
  await client.query(sql);
  console.log('schema applied');
} finally {
  await client.end();
}
