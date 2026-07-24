CREATE TABLE calendar_tokens_with_optional_alarm (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  alarm_minutes INTEGER NOT NULL DEFAULT 30 CHECK (alarm_minutes IN (0, 10, 30, 60, 1440)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

INSERT INTO calendar_tokens_with_optional_alarm (
  id,
  member_id,
  token_hash,
  alarm_minutes,
  created_at,
  updated_at,
  revoked_at
)
SELECT
  id,
  member_id,
  token_hash,
  alarm_minutes,
  created_at,
  updated_at,
  revoked_at
FROM calendar_tokens;

DROP TABLE calendar_tokens;

ALTER TABLE calendar_tokens_with_optional_alarm RENAME TO calendar_tokens;
