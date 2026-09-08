import fs from 'node:fs';
import path from 'node:path';

function patchAll(relative) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH26: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const matches = original.match(/18:00/g)?.length ?? 0;
  if (!matches) throw new Error(`PATCH26: no 18:00 upload-time anchors found in ${relative}`);
  const updated = original.replaceAll('18:00', '19:00');
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH26: ${relative} upload closing time changed 18:00 -> 19:00 (${matches} occurrence(s)).`);
}

patchAll('components/institution-portal.tsx');
patchAll('app/api/institution/route.ts');
patchAll('app/api/uploads/prepare/route.ts');

console.log('PATCH26: institution BUYRUQ and criterion file uploads are now open daily until 19:00 Asia/Tashkent.');
