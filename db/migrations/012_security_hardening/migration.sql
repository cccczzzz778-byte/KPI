CREATE TABLE IF NOT EXISTS auth_throttles (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_throttles_blocked_idx ON auth_throttles(blocked_until);
CREATE INDEX IF NOT EXISTS auth_throttles_updated_idx ON auth_throttles(updated_at);

CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  identifier_hash TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS security_events_type_idx ON security_events(event_type);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS sessions_last_seen_idx ON sessions(last_seen_at);

-- Security v2 stores only SHA-256 digests of session and upload tokens.
-- Existing raw-token sessions/intents are invalidated once during this migration.
DELETE FROM sessions;
DELETE FROM upload_intents;
