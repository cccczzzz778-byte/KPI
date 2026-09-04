import fs from 'node:fs';
import path from 'node:path';

const migrationTarget = path.join(process.cwd(), 'db/migrations/010_single-admin-account/migration.sql');
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.writeFileSync(
  migrationTarget,
  `BEGIN;

DELETE FROM sessions
WHERE user_email IN (SELECT email FROM users WHERE role = 'admin');

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES (
  'admin',
  'Admin',
  'admin',
  '',
  1,
  'scrypt$90fe5c7864bfa447d6be8717b7522e0a$0cb3e2c49410e8baef5cf1e7dacf498d04a984f51f168cf1ff243b3f9649a723',
  ''
)
ON CONFLICT (email) DO UPDATE SET
  name = 'Admin',
  role = 'admin',
  commission = '',
  active = 1,
  password_hash = EXCLUDED.password_hash,
  institution_id = '',
  updated_at = NOW();

UPDATE users
SET active = 0, updated_at = NOW()
WHERE role = 'admin' AND email <> 'admin';

COMMIT;
`,
  'utf8',
);

console.log('Created migration 010_single-admin-account');
