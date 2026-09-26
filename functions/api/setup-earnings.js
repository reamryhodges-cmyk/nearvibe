const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequest({ env }) {
  if (!env.DB) return new Response(JSON.stringify({ ok: false, error: 'D1 binding DB is not configured.' }), { status: 503, headers });
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS creator_earnings (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,available_pence INTEGER NOT NULL DEFAULT 0 CHECK(available_pence >= 0),pending_pence INTEGER NOT NULL DEFAULT 0 CHECK(pending_pence >= 0),lifetime_pence INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_pence >= 0),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS earning_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),amount_pence INTEGER NOT NULL CHECK(amount_pence > 0),type TEXT NOT NULL,reference_type TEXT,reference_id TEXT,idempotency_key TEXT NOT NULL UNIQUE,metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_earnings_user ON earning_transactions(user_id,id)').run();
    return new Response(JSON.stringify({ ok: true, earningsTables: true }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Database setup failed.' }), { status: 500, headers });
  }
}
