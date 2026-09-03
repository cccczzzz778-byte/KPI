# Buxoro KPI Nazorat

Buxoro sog‘liqni saqlash tizimi uchun 60 kunlik KPI nazorat platformasi.

- Deployment: GitHub → Railway
- Database: PostgreSQL (`DATABASE_URL`)
- Fayllar: Railway Storage Bucket (S3-compatible, 30 MB/fayl)
- Build vaqtida `source.bundle.*.b64` fayllari `bootstrap.mjs` orqali Next.js source kodiga ochiladi.
