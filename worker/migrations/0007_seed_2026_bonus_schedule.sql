-- Seed the remaining 2026 bonus schedule whose publication or invoice date is after 2026-08-03.
-- Deterministic IDs and INSERT OR IGNORE make this safe against accidental duplicate execution.

INSERT OR IGNORE INTO important_items (
  id, uid, status, kind, submitter_member_id, title, content_markdown, start_date, end_date,
  sequence, review_note, created_by, reviewed_by, created_at, updated_at, published_at
) VALUES
  ('bonus-base-2026-07-08', 'bonus-base-2026-07-08@wq-meeting-calendar', 'published', 'bonus', NULL, '基础薪酬', 'Base fees (paid monthly)', '2026-07-01', '2026-08-31', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-base-2026-09-10', 'bonus-base-2026-09-10@wq-meeting-calendar', 'published', 'bonus', NULL, '基础薪酬', 'Base fees (paid monthly)', '2026-09-01', '2026-10-31', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-base-2026-11-12', 'bonus-base-2026-11-12@wq-meeting-calendar', 'published', 'bonus', NULL, '基础薪酬', 'Base fees (paid monthly)', '2026-11-01', '2026-12-31', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q2', 'bonus-quarterly-2026-q2@wq-meeting-calendar', 'published', 'bonus', NULL, '季度薪酬', 'Quarterly Fees', '2026-04-01', '2026-06-30', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q3', 'bonus-quarterly-2026-q3@wq-meeting-calendar', 'published', 'bonus', NULL, '季度薪酬', 'Quarterly Fees', '2026-07-01', '2026-09-30', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q4', 'bonus-quarterly-2026-q4@wq-meeting-calendar', 'published', 'bonus', NULL, '季度薪酬', 'Quarterly Fees', '2026-10-01', '2026-12-31', 0, '根据 2026 奖金日程导入', 'admin', 'admin', CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO important_item_calendar_dates (
  id, item_id, date_kind, uid, event_date, status, sequence, created_at, updated_at
) VALUES
  ('bonus-base-2026-07-08-payment', 'bonus-base-2026-07-08', 'payment', 'bonus-base-2026-07-08-payment@wq-meeting-calendar', '2026-09-30', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-base-2026-09-10-payment', 'bonus-base-2026-09-10', 'payment', 'bonus-base-2026-09-10-payment@wq-meeting-calendar', '2026-11-30', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-base-2026-11-12-payment', 'bonus-base-2026-11-12', 'payment', 'bonus-base-2026-11-12-payment@wq-meeting-calendar', '2027-01-31', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q2-announcement', 'bonus-quarterly-2026-q2', 'announcement', 'bonus-quarterly-2026-q2-announcement@wq-meeting-calendar', '2026-08-25', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q2-payment', 'bonus-quarterly-2026-q2', 'payment', 'bonus-quarterly-2026-q2-payment@wq-meeting-calendar', '2026-09-30', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q3-announcement', 'bonus-quarterly-2026-q3', 'announcement', 'bonus-quarterly-2026-q3-announcement@wq-meeting-calendar', '2026-11-24', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q3-payment', 'bonus-quarterly-2026-q3', 'payment', 'bonus-quarterly-2026-q3-payment@wq-meeting-calendar', '2026-12-31', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q4-announcement', 'bonus-quarterly-2026-q4', 'announcement', 'bonus-quarterly-2026-q4-announcement@wq-meeting-calendar', '2027-02-23', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('bonus-quarterly-2026-q4-payment', 'bonus-quarterly-2026-q4', 'payment', 'bonus-quarterly-2026-q4-payment@wq-meeting-calendar', '2027-03-31', 'scheduled', 0, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);
