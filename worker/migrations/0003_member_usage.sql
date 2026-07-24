-- Additive migration: keep all existing members, sessions, meetings and feeds.
ALTER TABLE members ADD COLUMN wq_id_ciphertext TEXT;
ALTER TABLE member_import_rows ADD COLUMN wq_id_ciphertext TEXT;

CREATE TABLE member_activity (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  first_login_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  login_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX member_activity_last_active_idx ON member_activity(last_active_at DESC);

-- Recover the activity still represented by non-expired or not-yet-cleaned sessions.
INSERT INTO member_activity (member_id, first_login_at, last_login_at, last_active_at, login_count)
SELECT member_id, MIN(created_at), MAX(created_at), MAX(last_seen_at), COUNT(*)
FROM sessions
WHERE role = 'member' AND member_id IS NOT NULL
GROUP BY member_id;
