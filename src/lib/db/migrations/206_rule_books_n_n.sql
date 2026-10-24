CREATE TABLE IF NOT EXISTS rule_books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_key_rules (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  rule_book_id TEXT NOT NULL REFERENCES rule_books(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(api_key_id, rule_book_id)
);

CREATE INDEX IF NOT EXISTS idx_akr_api_key_id ON api_key_rules(api_key_id);
CREATE INDEX IF NOT EXISTS idx_akr_rule_book_id ON api_key_rules(rule_book_id);
