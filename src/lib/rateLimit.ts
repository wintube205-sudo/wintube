// Rate limiter using D1 database
import type { D1Database } from '@cloudflare/workers-types';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export async function checkRateLimit(
  db: D1Database,
  userId: number,
  action: string,
  maxCount: number,
  windowMinutes: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Clean old entries
  await db.prepare(
    `DELETE FROM rate_limits WHERE user_id = ? AND action = ? AND window_start < ?`
  ).bind(userId, action, windowStart).run();

  // Count recent entries
  const result = await db.prepare(
    `SELECT COUNT(*) as cnt, MIN(window_start) as oldest 
     FROM rate_limits WHERE user_id = ? AND action = ? AND window_start >= ?`
  ).bind(userId, action, windowStart).first<{ cnt: number; oldest: string | null }>();

  const count = result?.cnt || 0;

  if (count >= maxCount) {
    const oldestTime = result?.oldest ? new Date(result.oldest).getTime() : Date.now();
    const resetIn = Math.max(0, Math.ceil((oldestTime + windowMinutes * 60 * 1000 - Date.now()) / 1000));
    return { allowed: false, remaining: 0, resetIn };
  }

  // Add new entry
  await db.prepare(
    `INSERT INTO rate_limits (user_id, action, window_start) VALUES (?, ?, datetime('now'))`
  ).bind(userId, action).run();

  return { allowed: true, remaining: maxCount - count - 1, resetIn: 0 };
}

// Check how many points user earned from watching in last hour
export async function getWatchEarningsInLastHour(
  db: D1Database,
  userId: number
): Promise<number> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const result = await db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total 
     FROM point_transactions 
     WHERE user_id = ? AND type = 'watch' AND created_at >= ?`
  ).bind(userId, hourAgo).first<{ total: number }>();
  return result?.total || 0;
}
