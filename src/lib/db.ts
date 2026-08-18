import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});

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
