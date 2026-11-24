CREATE TABLE IF NOT EXISTS daily_evaluations (
  id BIGSERIAL PRIMARY KEY,
  institution_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  evaluation_date DATE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 2),
  note TEXT NOT NULL DEFAULT '',
  evaluator_email TEXT NOT NULL DEFAULT '',
  evaluator_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, criterion_id, evaluation_date)
);

CREATE INDEX IF NOT EXISTS daily_evaluations_institution_date_idx
  ON daily_evaluations (institution_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS daily_evaluations_criterion_date_idx
  ON daily_evaluations (criterion_id, evaluation_date DESC);

INSERT INTO daily_evaluations (
  institution_id, criterion_id, evaluation_date, score, note,
  evaluator_email, evaluator_name, created_at, updated_at
)
SELECT DISTINCT ON (institution_id, criterion_id, (updated_at AT TIME ZONE 'Asia/Tashkent')::date)
  institution_id,
  criterion_id,
  (updated_at AT TIME ZONE 'Asia/Tashkent')::date,
  score,
  note,
  evaluator_email,
  evaluator_name,
  updated_at,
  updated_at
FROM evaluations
ORDER BY institution_id, criterion_id, (updated_at AT TIME ZONE 'Asia/Tashkent')::date, updated_at DESC
ON CONFLICT (institution_id, criterion_id, evaluation_date) DO NOTHING;
