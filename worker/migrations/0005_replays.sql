ALTER TABLE members ADD COLUMN public_wq_id INTEGER NOT NULL DEFAULT 1 CHECK (public_wq_id IN (0, 1));

CREATE TABLE replay_groups (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  occurrence_key TEXT,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (event_id, occurrence_key)
);

CREATE INDEX replay_groups_date_idx ON replay_groups(meeting_date DESC, updated_at DESC);

CREATE TABLE replay_links (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES replay_groups(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('baidu', 'quark', 'aliyun', 'onedrive', 'google_drive', 'dropbox', 'weiyun', 'other')),
  share_url TEXT NOT NULL,
  url_hash TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitter_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'rejected', 'disabled')),
  review_note TEXT NOT NULL DEFAULT '',
  link_version INTEGER NOT NULL DEFAULT 1 CHECK (link_version >= 1),
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  approved_at INTEGER,
  disabled_at INTEGER
);

CREATE INDEX replay_links_group_status_idx ON replay_links(group_id, status, updated_at DESC);
CREATE INDEX replay_links_status_created_idx ON replay_links(status, created_at DESC);
CREATE INDEX replay_links_submitter_idx ON replay_links(submitter_member_id, created_at DESC);

CREATE TABLE replay_reports (
  id TEXT PRIMARY KEY,
  replay_link_id TEXT NOT NULL REFERENCES replay_links(id) ON DELETE CASCADE,
  reporter_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  link_version INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unavailable', 'invalid_code', 'content_mismatch', 'other')),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  UNIQUE (replay_link_id, reporter_member_id, link_version)
);

CREATE INDEX replay_reports_link_status_idx ON replay_reports(replay_link_id, status, created_at DESC);
CREATE INDEX replay_reports_status_created_idx ON replay_reports(status, created_at DESC);
