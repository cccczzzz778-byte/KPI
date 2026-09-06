import fs from 'node:fs';

const targets = [
  'lib/server-auth.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/uploads/prepare/route.ts',
  'app/api/uploads/complete/route.ts',
  'app/api/uploads/blob/route.ts',
  'next.config.ts',
  'next.config.mjs',
  'app/layout.tsx',
  'scripts/migrate.mjs',
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  console.log(`\n=== SECURITY_INSPECT:${file} ===\n`);
  console.log(fs.readFileSync(file, 'utf8'));
  console.log(`\n=== END_SECURITY_INSPECT:${file} ===\n`);
}
