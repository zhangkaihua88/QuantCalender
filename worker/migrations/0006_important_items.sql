CREATE TABLE important_items (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'cancelled')),
  kind TEXT NOT NULL CHECK (kind IN ('ppa', 'competition', 'bonus')),
  submitter_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  review_note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX important_items_status_date_idx ON important_items(status, start_date, end_date);
CREATE INDEX important_items_submitter_idx ON important_items(submitter_member_id, created_at DESC);

CREATE TABLE important_item_calendar_dates (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES important_items(id) ON DELETE CASCADE,
  date_kind TEXT NOT NULL CHECK (date_kind IN ('announcement', 'payment')),
  uid TEXT NOT NULL UNIQUE,
  event_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'cancelled')),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (item_id, date_kind)
);

CREATE INDEX important_item_calendar_dates_item_idx ON important_item_calendar_dates(item_id, date_kind);
