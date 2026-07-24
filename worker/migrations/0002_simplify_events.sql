-- The project is still in testing. Rebuild meeting storage around the simplified
-- Beijing-time form and intentionally discard existing test meetings.
DROP TABLE IF EXISTS event_exceptions;
DROP TABLE IF EXISTS events;

DELETE FROM audit_logs WHERE entity_type = 'event';

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'cancelled')),
  submitter_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  meeting_language TEXT NOT NULL CHECK (meeting_language IN ('zh', 'en', 'bilingual', 'other')),
  registration_url TEXT NOT NULL,
  start_beijing TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30, 60, 90, 120, 180)),
  recurrence_json TEXT NOT NULL DEFAULT '{"kind":"none","untilLocal":null}',
  sequence INTEGER NOT NULL DEFAULT 0,
  review_note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX events_status_idx ON events(status);
CREATE INDEX events_submitter_idx ON events(submitter_member_id, created_at DESC);

CREATE TABLE event_exceptions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('cancel', 'override')),
  override_start_local TEXT,
  override_end_local TEXT,
  override_timezone TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (event_id, occurrence_key)
);
