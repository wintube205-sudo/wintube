// Auth routes - server-side authentication
import { Hono } from 'hono';
import type { HonoEnv } from '../lib/types';
import { CONFIG } from '../lib/types';
import { hashPassword, verifyPassword, generateToken, generateId, generateRefCode } from '../lib/crypto';
import { checkRateLimit } from '../lib/rateLimit';

const auth = new Hono<HonoEnv>();

// ═══ REGISTER ═══
auth.post('/register', async (c) => {
  const body = await c.req.json<{
    name?: string; email?: string; password?: string; referralCode?: string;
  }>();

  const { name, email, password, referralCode } = body;
  if (!name || !email || !password) {
    return c.json({ error: 'Name, email and password required' }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }
  if (name.length > 50 || email.length > 100) {
    return c.json({ error: 'Name or email too long' }, 400);
  }

  const db = c.env.DB;

  // Check if email exists
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const uid = generateId();
  const passwordHash = await hashPassword(password);
  const refCode = generateRefCode(uid);

  // Create user
  const result = await db.prepare(
    `INSERT INTO users (uid, name, email, password_hash, auth_provider, points, ref_code)
     VALUES (?, ?, ?, ?, 'email', ?, ?)`
  ).bind(uid, name.trim(), email.toLowerCase().trim(), passwordHash, CONFIG.SIGNUP_BONUS, refCode).run();

  const userId = result.meta.last_row_id;

  // Record signup bonus
  await db.prepare(
    `INSERT INTO point_transactions (user_id, amount, type, description)
     VALUES (?, ?, 'signup_bonus', 'Welcome bonus')`
  ).bind(userId, CONFIG.SIGNUP_BONUS).run();

  // Handle referral
  if (referralCode) {
    const referrer = await db.prepare(
      'SELECT id FROM users WHERE ref_code = ?'
    ).bind(referralCode.toUpperCase().trim()).first<{ id: number }>();

    if (referrer && referrer.id !== userId) {
      // Give bonus to both
      await db.batch([
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
          .bind(CONFIG.REFERRAL_BONUS_REFERRER, referrer.id),
        db.prepare('UPDATE users SET points = points + ?, referred_by = ? WHERE id = ?')
          .bind(CONFIG.REFERRAL_BONUS_REFERRED, referralCode.toUpperCase(), userId),
        db.prepare(`INSERT INTO point_transactions (user_id, amount, type, description) VALUES (?, ?, 'referral_bonus', 'Referral bonus')`)
          .bind(referrer.id, CONFIG.REFERRAL_BONUS_REFERRER),
        db.prepare(`INSERT INTO point_transactions (user_id, amount, type, description) VALUES (?, ?, 'referral_bonus', 'Referred signup bonus')`)
          .bind(userId, CONFIG.REFERRAL_BONUS_REFERRED),
      ]);
    }
  }

  // Create session
  const session = await createSession(db, userId as number, c.req.raw);

  return c.json({
    success: true,
    user: { uid, name: name.trim(), email: email.toLowerCase(), points: CONFIG.SIGNUP_BONUS, refCode },
    token: session.token,
  }, 201);
});

// ═══ LOGIN ═══
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  const db = c.env.DB;

  const user = await db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first<{
    id: number; uid: string; name: string; email: string;
    password_hash: string; points: number; ref_code: string; is_banned: number;
  }>();

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (user.is_banned) {
    return c.json({ error: 'Account suspended' }, 403);
  }

  // Rate limit login attempts
  const rl = await checkRateLimit(db, user.id, 'login', CONFIG.MAX_LOGIN_ATTEMPTS, 60);
  if (!rl.allowed) {
    return c.json({ error: `Too many attempts. Try again in ${rl.resetIn}s` }, 429);
  }

  if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const session = await createSession(db, user.id, c.req.raw);

  return c.json({
    success: true,
    user: {
      uid: user.uid, name: user.name, email: user.email,
      points: user.points, refCode: user.ref_code,
    },
    token: session.token,
  });
});

// ═══ LOGOUT ═══
auth.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return c.json({ success: true });
});

// ═══ GET CURRENT USER ═══
auth.get('/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ user: null });

  const db = c.env.DB;
  const session = await db.prepare(
    `SELECT u.uid, u.name, u.email, u.points, u.ref_code, u.avatar_url, u.auth_provider
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_banned = 0`
  ).bind(token).first();

  if (!session) return c.json({ user: null });

  return c.json({ user: session });
});

// ═══ Helper: Create Session ═══
async function createSession(db: D1Database, userId: number, req: Request) {
  const token = generateToken(48);
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
  const ua = req.headers.get('User-Agent') || 'unknown';

  // Clean old sessions (keep max 5 per user)
  await db.prepare(
    `DELETE FROM sessions WHERE user_id = ? AND id NOT IN (
      SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 4
    )`
  ).bind(userId, userId).run();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(sessionId, userId, token, expiresAt, ip, ua).run();

  return { token, expiresAt };
}

export default auth;
