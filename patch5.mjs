import fs from 'node:fs';
import path from 'node:path';

const roots = [
  path.join(process.cwd(), 'db/migrations'),
  path.join(process.cwd(), 'netlify/database/migrations'),
];
const migrationRoot = roots.find((item) => fs.existsSync(item)) || roots[0];
const migrationTarget = path.join(migrationRoot, '011_training-center-account/migration.sql');
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.writeFileSync(
  migrationTarget,
  `BEGIN;

INSERT INTO institutions (id, name, district, type, active)
VALUES (
  'm-038',
  'Respublika o‘rta tibbiyot va farmatsevtika xodimlari malakasini oshirish va ularni ixtisoslashtirish markazi',
  'Buxoro shahar',
  'Malaka oshirish markazi',
  1
)
ON CONFLICT (id) DO UPDATE SET
  active = 1;

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES (
  'muassasa-038',
  COALESCE((SELECT name FROM institutions WHERE id = 'm-038'), 'Respublika o‘rta tibbiyot va farmatsevtika xodimlari malakasini oshirish va ularni ixtisoslashtirish markazi'),
  'institution',
  '',
  1,
  'scrypt$01c5ce5d81bbbf6fbe0a99b672a1fbc8$0f85e8065b583a58d4cf432655197a91662940314cb33b044819cae6c11c745f',
  'm-038'
)
ON CONFLICT (email) DO UPDATE SET
  name = COALESCE((SELECT name FROM institutions WHERE id = 'm-038'), EXCLUDED.name),
  role = 'institution',
  commission = '',
  active = 1,
  password_hash = EXCLUDED.password_hash,
  institution_id = 'm-038',
  updated_at = NOW();

DELETE FROM sessions WHERE user_email = 'muassasa-038';

COMMIT;
`,
  'utf8',
);

console.log('Created migration 011_training-center-account for muassasa-038.');
