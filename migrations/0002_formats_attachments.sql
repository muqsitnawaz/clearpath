ALTER TABLE submissions ADD COLUMN format TEXT NOT NULL DEFAULT 'text';
ALTER TABLE submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  extracted_text TEXT,
  small_print INTEGER NOT NULL DEFAULT 0,
  visual_note TEXT,
  extraction_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_att_sub ON attachments(submission_id, version);
