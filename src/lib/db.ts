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

// Cached check — only hits the DB at most once per 10 seconds
export const checkDbConnection = async (): Promise<boolean> => {
  if (connectionCache && connectionCache.ok && Date.now() < connectionCache.expiresAt) {
    return true;
  }
  try {
    await pool.query('SELECT 1');
    connectionCache = { ok: true, expiresAt: Date.now() + 10_000 };
    return true;
  } catch {
    connectionCache = { ok: false, expiresAt: Date.now() + 5_000 };
    return false;
  }
};

export default pool;
