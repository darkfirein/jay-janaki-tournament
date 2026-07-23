const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// The dev fallback below is a publicly-known string (it's sitting right here
// in the source). If this ran in production without a real JWT_SECRET set,
// anyone could forge their own admin token signed with this same string and
// get full admin access — so refuse to start rather than silently accept
// that. Only local/dev runs are allowed to fall back to it.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Refusing to start in production with the ' +
    'default signing key, since anyone could forge an admin login with it. Set JWT_SECRET ' +
    '(a long random string) in your Render environment variables.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const COOKIE_NAME = 'token';

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Login required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      const result = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [payload.id]);
      if (!result.rows[0]) return res.status(401).json({ error: 'Account not found.' });
      if (result.rows[0].is_blocked) {
        return res.status(403).json({ error: 'Your account has been blocked. Contact support for help.' });
      }
    }
    req.user = payload; // { id, name, game_uid, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// Cross-site cookie (frontend on a different domain than the Render backend)
// needs SameSite=None + Secure, or browsers will silently refuse to store/send it.
// In local dev (http://localhost) Secure cookies don't work, so we relax both
// flags together based on NODE_ENV.
const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches the JWT's own expiresIn
  path: '/',
};

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET, COOKIE_NAME, setAuthCookie, clearAuthCookie };
