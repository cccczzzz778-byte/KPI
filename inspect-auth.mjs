import fs from 'node:fs';

const files = [
  'app/api/auth/login/route.ts',
  'lib/server-auth.ts',
  'lib/auth.ts',
  'lib/password.ts',
  'scripts/migrate.mjs',
  'netlify/database/migrations/001_initial/migration.sql',
  'netlify/database/migrations/002_fix-initial-passwords/migration.sql',
  'netlify/database/migrations/004_fix-institution-passwords/migration.sql',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  console.log(`\n===== AUTH_INSPECT ${file} =====`);
  console.log(fs.readFileSync(file, 'utf8'));
  console.log(`===== END_AUTH_INSPECT ${file} =====\n`);
}
