-- Family school-notice bot schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  grade TEXT
);

CREATE TABLE IF NOT EXISTS organisations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('school', 'tutorial')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS child_organisations (
  child_id INTEGER NOT NULL,
  organisation_id INTEGER NOT NULL,
  PRIMARY KEY (child_id, organisation_id),
  FOREIGN KEY (child_id) REFERENCES children(id),
  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

CREATE TABLE IF NOT EXISTS family_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'parent', 'helper'))
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  raw_text TEXT,
  file_key TEXT,
  sender_telegram_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id INTEGER,
  organisation_id INTEGER,
  title TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  location TEXT,
  type TEXT NOT NULL,
  items_to_bring TEXT,
  uniform TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (notice_id) REFERENCES notices(id),
  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

CREATE TABLE IF NOT EXISTS event_children (
  event_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  PRIMARY KEY (event_id, child_id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (child_id) REFERENCES children(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER,
  title TEXT NOT NULL,
  due_at TEXT,
  assignee_role TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  sent_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  organisation_id INTEGER,
  title TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT,
  items_to_bring TEXT,
  notes TEXT,
  FOREIGN KEY (child_id) REFERENCES children(id),
  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  sender_telegram_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_actions (
  telegram_id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
