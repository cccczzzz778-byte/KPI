CREATE TABLE IF NOT EXISTS upload_intents (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS upload_intents_expires_at_idx ON upload_intents(expires_at);
