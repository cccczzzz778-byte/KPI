CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id BIGSERIAL PRIMARY KEY,
  institution_id TEXT NOT NULL,
  round_day INTEGER NOT NULL,
  criterion_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  evaluator_email TEXT NOT NULL DEFAULT '',
  evaluator_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, round_day, criterion_id)
);

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'evaluator',
  commission TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_email_idx ON sessions(user_email);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  round_day INTEGER NOT NULL,
  criterion_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, name, role, commission, active, password_hash) VALUES
('admin', 'Administrator', 'admin', '', 1, 'scrypt$c732c5791a1b57d7f29ed6b107b49e39$97a11ef00cc1ff7fee6a231e92d2cb6b1273589171eaad1421e58655b9c276d0'),
('monitor', 'Tahlil va monitoring', 'monitor', '', 1, 'scrypt$c32c060222105ad6eb0d039fbdf88afd$3551d01cd9103d4e8a9c782ca60ae76d0d9dd55993813ad5194284a3d680a9c8'),
('baholovchi-ijro', 'Ijro intizomi baholovchisi', 'evaluator', 'ijro', 1, 'scrypt$7d4ede35c64733bae9d80b6ee29d0e6b$5ef034651a5a405bb98e097acf2e6eb20cfb7c58e392c2b3da22dd1dd9f88eee'),
('baholovchi-birlamchi', 'Birlamchi yordam baholovchisi', 'evaluator', 'birlamchi', 1, 'scrypt$c469cb171545d4cfd290a00457d577a1$11f3af4bdd445a510af5a5eb9ef51924289b75fcd02ba17a44deb9d16cac79af'),
('baholovchi-statsionar', 'Statsionar xizmat baholovchisi', 'evaluator', 'statsionar', 1, 'scrypt$cb57fd05f10cc041265631094cb19c0a$8e9c438e9564f6fed759a30db8d31fea278acae3bec126abe34ad69caff73758'),
('baholovchi-raqam', 'Raqamlashtirish baholovchisi', 'evaluator', 'raqam', 1, 'scrypt$7de04d1625c5b62d059768b353cacbdd$a22eba8640c4c3abda851b888f8dd8ac9c77fc1fb5e5b3f261799c2e80b6c7fa'),
('baholovchi-moliya', 'Moliya va infratuzilma baholovchisi', 'evaluator', 'moliya', 1, 'scrypt$62e41e6c8cc240cde3449013b20df6e5$6d1f4fddeb0f78eb14f22ce0f107eddea9b2c2acf5e6be1fc905f4d206b67b33')
ON CONFLICT (email) DO NOTHING;
