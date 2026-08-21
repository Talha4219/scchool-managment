import { Pool } from 'pg';

// In dev, Turbopack/webpack hot-reloads this module on every file save,
// which would re-run `new Pool(...)` each time and leak the previous pool's
// connections (never closed) until the DB's connection limit is exhausted —
// surfacing as random, intermittent query failures across the whole app.
// Stashing the pool on `globalThis` survives the module re-evaluation so
// dev keeps reusing the same pool; production just gets one pool as before.
const globalForPool = globalThis as unknown as { __pgPool?: Pool };

const pool = globalForPool.__pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPool.__pgPool = pool;
}

let connectionCache: { ok: boolean; expiresAt: number } | null = null;

export const query = async (text: string, params?: any[]) => {
  const res = await pool.query(text, params);
  return res;
};

// Cached check, called at the top of nearly every server action — a cold
// cache costs a full extra "SELECT 1" round trip before the action's real
// query even starts. 10s meant most navigations (each firing several
// actions) paid that cost repeatedly; 60s still catches a real outage
// within a minute (every write path also has its own try/catch for that),
// while cutting this to roughly zero extra round trips during normal use.
// The failure window stays short so a real outage recovering is noticed fast.
export const checkDbConnection = async (): Promise<boolean> => {
  if (connectionCache && connectionCache.ok && Date.now() < connectionCache.expiresAt) {
    return true;
  }
  try {
    await pool.query('SELECT 1');
    connectionCache = { ok: true, expiresAt: Date.now() + 60_000 };
    return true;
  } catch {
    connectionCache = { ok: false, expiresAt: Date.now() + 5_000 };
    return false;
  }
};

export default pool;
