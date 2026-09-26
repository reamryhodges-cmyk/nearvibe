CREATE TABLE IF NOT EXISTS creator_earnings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_pence INTEGER NOT NULL DEFAULT 0 CHECK(available_pence >= 0),
  pending_pence INTEGER NOT NULL DEFAULT 0 CHECK(pending_pence >= 0),
  lifetime_pence INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_pence >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS earning_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount_pence INTEGER NOT NULL CHECK(amount_pence > 0),
  type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_earnings_user ON earning_transactions(user_id,id);
