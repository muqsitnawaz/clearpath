CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('personal_loan','credit_card','mortgage')),
  channel TEXT NOT NULL CHECK (channel IN ('affiliate','email','paid_social','search_ad','landing_page','sms')),
  partner TEXT,
  url TEXT,
  body TEXT NOT NULL,
  submitter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','changes_requested','approved','rejected')),
  lane TEXT NOT NULL CHECK (lane IN ('fast','standard','escalated')),
  risk_score INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  assignee TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX idx_sub_status ON submissions(status, lane);

CREATE TABLE findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  version INTEGER NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
  excerpt TEXT,
  message TEXT NOT NULL,
  suggestion TEXT NOT NULL
);
CREATE INDEX idx_find_sub ON findings(submission_id, version);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX idx_ev_sub ON events(submission_id);
