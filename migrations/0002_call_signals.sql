PRAGMA foreign_keys = ON;

-- Persistent WebRTC signalling storage. The API keeps a CREATE TABLE fallback
-- for existing environments, while this migration makes fresh deployments deterministic.
CREATE TABLE IF NOT EXISTS call_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_signals_recipient
  ON call_signals(call_id, recipient_id, id);

CREATE INDEX IF NOT EXISTS idx_calls_match_status
  ON calls(match_id, status, id);

CREATE INDEX IF NOT EXISTS idx_call_offers_recipient_status
  ON call_offers(recipient_id, status, id);
