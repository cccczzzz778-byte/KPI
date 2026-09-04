import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Patch anchor not found: ${label}`);
  return text.replace(from, to);
}

// Add the 38th institution and its own institution account.
// Existing institutions, uploads, evaluations and settings are untouched.
const migrationTarget = path.join(process.cwd(), 'netlify/database/migrations/009_add-buxoro-training-center/migration.sql');
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.writeFileSync(
  migrationTarget,
  `BEGIN;
INSERT INTO institutions (id, name, district, type, active)
VALUES ('m-038', 'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали', 'Buxoro shahar', 'Malaka oshirish markazi', 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district = EXCLUDED.district,
  type = EXCLUDED.type,
  active = 1;

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES (
  'muassasa-038',
  'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали',
  'institution',
  '',
  1,
  'scrypt$7eebb029deaa7f3c6205906ada4af39f$3d45cfde1050033a812eb0a04f69e6bf6ecaa9ccbad809571f45220d7a122439',
  'm-038'
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'institution',
  commission = '',
  active = 1,
  institution_id = 'm-038',
  updated_at = NOW();
COMMIT;
`,
  'utf8',
);
console.log('Created migration 009_add-buxoro-training-center');

// The existing /api/files DELETE endpoint already deletes the DB row and storage object.
// Wire that safe delete action into the admin BUYRUQ table.
patchFile('components/kpi-app.tsx', (text) => {
  text = replaceOnce(
    text,
    `<AdminPanel data={data} onRefresh={() => void loadData()} onAddUser={() => openUser()} onEditUser={openUser} onAddInstitution={() => openInstitution()} onEditInstitution={openInstitution} onOpenEvaluation={openEvaluation} selectedRound={selectedRound} />`,
    `<AdminPanel data={data} onRefresh={() => void loadData()} onAddUser={() => openUser()} onEditUser={openUser} onAddInstitution={() => openInstitution()} onEditInstitution={openInstitution} onOpenEvaluation={openEvaluation} onDeleteAttachment={deleteAttachment} selectedRound={selectedRound} />`,
    'admin-panel-delete-prop-call',
  );

  text = replaceOnce(
    text,
    `function AdminPanel({ data, onRefresh, onAddUser, onEditUser, onAddInstitution, onEditInstitution, onOpenEvaluation, selectedRound }: { data: DashboardData; onRefresh: () => void; onAddUser: () => void; onEditUser: (user: AppUser) => void; onAddInstitution: () => void; onEditInstitution: (institution: Institution) => void; onOpenEvaluation: (institution: Institution) => void; selectedRound: number }) {`,
    `function AdminPanel({ data, onRefresh, onAddUser, onEditUser, onAddInstitution, onEditInstitution, onOpenEvaluation, onDeleteAttachment, selectedRound }: { data: DashboardData; onRefresh: () => void; onAddUser: () => void; onEditUser: (user: AppUser) => void; onAddInstitution: () => void; onEditInstitution: (institution: Institution) => void; onOpenEvaluation: (institution: Institution) => void; onDeleteAttachment: (id: string) => void; selectedRound: number }) {`,
    'admin-panel-delete-prop-signature',
  );

  text = replaceOnce(
    text,
    `<TableCell className="action-col"><a href={\`/api/files?id=\${order.id}\`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a></TableCell>`,
    `<TableCell className="action-col"><a href={\`/api/files?id=\${order.id}\`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a><Button variant="ghost" size="sm" onClick={() => void onDeleteAttachment(order.id)}><Trash2 /> O‘chirish</Button></TableCell>`,
    'admin-order-delete-button',
  );

  if (text.includes('37 ta asosiy ro‘yxat va keyingi qo‘shimchalarni boshqarish')) {
    text = text.replace('37 ta asosiy ro‘yxat va keyingi qo‘shimchalarni boshqarish', 'Muassasalar ro‘yxati va keyingi qo‘shimchalarni boshqarish');
  }
  return text;
});

console.log('Institution 038 + admin BUYRUQ deletion patch applied. Deleting an order frees the one-time upload slot for replacement.');
