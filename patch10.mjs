import fs from 'node:fs';

function show(file, mapper) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  console.log(`\n=== SECURITY_INSPECT:${file} ===\n`);
  console.log(mapper ? mapper(text) : text);
  console.log(`\n=== END_SECURITY_INSPECT:${file} ===\n`);
}

show('lib/password.ts');
show('components/institution-portal.tsx', (text) => text.split('\n').filter((line) => /uploadUrl|uploadHeaders|fetch\(|uploads\/prepare|uploads\/complete|method:\s*["']PUT/.test(line)).join('\n'));
show('components/kpi-app.tsx', (text) => text.split('\n').filter((line) => /uploadUrl|uploadHeaders|fetch\(|uploads\/prepare|uploads\/complete|method:\s*["']PUT/.test(line)).join('\n'));
show('db/migrations/001_initial/migration.sql');
show('db/migrations/002_storage/migration.sql');
show('db/migrations/003_auth/migration.sql');
