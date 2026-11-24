import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL sozlanmagan.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const root = path.join(process.cwd(), 'db', 'migrations');
  const dirs = (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of dirs) {
    const found = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (found.rowCount) continue;
    const sql = await fs.readFile(path.join(root, name, 'migration.sql'), 'utf8');
    console.log(`Applying ${name}`);
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    } catch (error) {
      console.error(`Migration ${name} failed`, error);
      throw error;
    }
  }
  await client.query('DELETE FROM upload_intents WHERE expires_at <= NOW()').catch(() => undefined);
  console.log('Database migrations complete.');
} finally {
  await client.end();
}
