-- Eski yuklangan fayllarni arxivlash: arxivdagi fayllar faqat administratorga ko'rinadi.
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS attachments_archived_at_idx ON attachments (archived_at);

-- 2026-yil 25-noyabrgacha (Toshkent vaqti) yuklangan barcha fayllar arxivga o'tkaziladi.
UPDATE attachments
   SET archived_at = NOW()
 WHERE archived_at IS NULL
   AND created_at < TIMESTAMPTZ '2026-11-25 00:00:00+05';
