PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  wq_id_hash TEXT NOT NULL UNIQUE,
  wq_id_hint TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('CN', 'HK')),
  record_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  import_batch_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE member_imports (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('staging', 'committed', 'abandoned')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  committed_at INTEGER
);

CREATE TABLE member_import_rows (
  import_id TEXT NOT NULL REFERENCES member_imports(id) ON DELETE CASCADE,
  wq_id_hash TEXT NOT NULL,
  wq_id_hint TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('CN', 'HK')),
  record_date TEXT NOT NULL,
  PRIMARY KEY (import_id, wq_id_hash)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX sessions_token_idx ON sessions(token_hash);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'cancelled')),
  submitter_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL,
  speaker TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  meeting_language TEXT NOT NULL CHECK (meeting_language IN ('zh', 'en', 'bilingual', 'other')),
  location_type TEXT NOT NULL CHECK (location_type IN ('online', 'offline', 'hybrid')),
  location_text TEXT NOT NULL,
  registration_url TEXT NOT NULL,
  registration_deadline_utc TEXT,
  source_timezone TEXT NOT NULL,
  start_local TEXT NOT NULL,
  end_local TEXT NOT NULL,
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
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

CREATE TABLE calendar_tokens (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  alarm_minutes INTEGER NOT NULL DEFAULT 30 CHECK (alarm_minutes IN (10, 30, 60, 1440)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_role TEXT NOT NULL,
  actor_member_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE login_attempts (
  key_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
);
