-- Store the single responsible person selected when the one-time order is uploaded.
CREATE TABLE IF NOT EXISTS institution_responsibles (
  institution_id TEXT PRIMARY KEY,
  responsible_name TEXT NOT NULL,
  responsible_phone TEXT NOT NULL,
  order_attachment_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS institution_order_once
  ON attachments (institution_id)
  WHERE source = 'institution_order';
