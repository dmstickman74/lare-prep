CREATE TABLE IF NOT EXISTS progress (
  user_id     text PRIMARY KEY,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progress_updated_at_idx ON progress (updated_at);
