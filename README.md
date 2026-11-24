# Buxoro KPI Nazorat

Buxoro sog‘liqni saqlash tizimi uchun 60 kunlik KPI nazorat platformasi (Next.js).

- Deployment: GitHub (`main`) → Railway avtomatik deploy
- Database: PostgreSQL (`DATABASE_URL`), migratsiyalar `db/migrations/` da, deploydan oldin `npm run migrate`
- Fayllar: Railway Storage Bucket (S3-compatible, 30 MB/fayl)
- Kirish: hozircha faqat administrator

## Ishga tushirish

```bash
npm install
npm test          # testlar
npm run build     # testlar + next build
npm run start
```

Kod oddiy fayllar ko‘rinishida saqlanadi: o‘zgartirish uchun tegishli faylni
to‘g‘ridan-to‘g‘ri tahrirlang (avvalgi `source.bundle` + `patchNN.mjs` zanjiri olib tashlangan).
