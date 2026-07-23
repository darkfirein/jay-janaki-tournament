const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { pool } = require('../db');
const { JWT_SECRET, requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { saveUploadedImage, isAllowedImageMime } = require('../lib/uploads');

const router = express.Router();

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

// Slows down password-guessing / spam-signup attempts — 15 tries per IP every 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, game_uid: user.game_uid, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, phone, password, game_uid, in_game_name, security_question, security_answer, referral_code } = req.body;
    if (!name || !password || !game_uid || !in_game_name || !security_question || !security_answer) {
      return res.status(400).json({ error: 'Name, Game UID, in-game name, password and a security question are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (security_answer.trim().length < 2) {
      return res.status(400).json({ error: 'Security answer is too short.' });
    }

    const normalizedUid = game_uid.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE game_uid = $1', [normalizedUid]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This Game UID is already registered.' });
    }

    // A referral code is just the referrer's Game UID. Invalid/unknown codes
    // are silently ignored rather than blocking signup — it's a bonus, not a gate.
    let referredBy = null;
    if (referral_code && referral_code.trim()) {
      const refUid = referral_code.trim().toLowerCase();
      if (refUid !== normalizedUid) {
        const refResult = await pool.query('SELECT id FROM users WHERE game_uid = $1', [refUid]);
        if (refResult.rows[0]) referredBy = refResult.rows[0].id;
      }
    }

    const hash = bcrypt.hashSync(password, 10);
    // Answer is normalized (trimmed + lowercased) before hashing so "Kathmandu"
    // and "kathmandu " both match later at forgot-password time.
    const answerHash = bcrypt.hashSync(security_answer.trim().toLowerCase(), 10);
    const result = await pool.query(
      `INSERT INTO users (name, phone, password_hash, role, game_uid, in_game_name, security_question, security_answer_hash, referred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, phone || '', hash, 'user', normalizedUid, in_game_name, security_question.trim(), answerHash, referredBy]
    );

    const user = { id: result.rows[0].id, name, game_uid: normalizedUid, role: 'user' };
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This Game UID is already registered.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Forgot password — no email/SMS service is configured, so identity is
// verified with a single request that carries either the security
// question's answer, or (for accounts created before this feature existed)
// name + phone. There is no separate "does this Game UID exist" lookup step
// on purpose: revealing that would let anyone enumerate registered Game
// UIDs. Because the frontend already knows the fixed list of preset
// questions, it can just show that list directly instead of asking the
// server which one applies.
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { game_uid, name, phone, security_answer, new_password } = req.body;
    if (!game_uid || !new_password) {
      return res.status(400).json({ error: 'Game UID and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const normalizedUid = game_uid.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE game_uid = $1', [normalizedUid]);
    const user = result.rows[0];

    // Same generic error on any mismatch — wrong UID, wrong answer, or wrong
    // name/phone all look identical from the outside.
    const genericError = 'The details provided did not match our records.';
    if (!user) return res.status(400).json({ error: genericError });

    let verified = false;
    if (user.security_answer_hash) {
      // Account has opted into a security question — that's the only valid
      // path for it, name+phone is not accepted even if sent.
      verified = !!security_answer && bcrypt.compareSync(security_answer.trim().toLowerCase(), user.security_answer_hash);
    } else if (name && phone) {
      // Legacy account with no security question set — fall back to the old check.
      const nameMatches = (user.name || '').trim().toLowerCase() === name.trim().toLowerCase();
      const phoneMatches = (user.phone || '').trim() === phone.trim();
      verified = nameMatches && phoneMatches;
    }
    if (!verified) return res.status(400).json({ error: genericError });

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Contact support for help.' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { game_uid, password } = req.body;
    if (!game_uid || !password) {
      return res.status(400).json({ error: 'Game UID and password are required.' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const normalizedUid = game_uid.trim().toLowerCase();

    const result = await pool.query('SELECT * FROM users WHERE game_uid = $1', [normalizedUid]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      await pool.query('INSERT INTO login_attempts (game_uid, ip, success) VALUES ($1,$2,false)', [normalizedUid, ip]);
      return res.status(401).json({ error: 'Incorrect Game UID or password.' });
    }
    if (user.is_blocked) {
      await pool.query('INSERT INTO login_attempts (game_uid, ip, success) VALUES ($1,$2,false)', [normalizedUid, ip]);
      return res.status(403).json({ error: 'Your account has been blocked. Contact support for help.' });
    }

    await pool.query('INSERT INTO login_attempts (game_uid, ip, success) VALUES ($1,$2,true)', [normalizedUid, ip]);

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({
      user: { id: user.id, name: user.name, game_uid: user.game_uid, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Current user's profile, plus a quick summary of their tournament activity
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, game_uid, in_game_name, created_at, security_question,
              role, avatar_path, wallet_balance, payout_method, payout_provider, payout_account_name, payout_account_number
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const statsResult = await pool.query(
      `SELECT
         COUNT(*)::int as total_bookings,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)::int as approved_bookings,
         COALESCE(SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END), 0)::int as wins,
         COALESCE(SUM(CASE WHEN is_winner = 1 THEN winning_amount ELSE 0 END), 0)::float as total_winnings
       FROM bookings WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ ...user, stats: statsResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Update name/phone/in-game name
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, phone, in_game_name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    await pool.query(
      'UPDATE users SET name = $1, phone = $2, in_game_name = $3 WHERE id = $4',
      [name, phone || '', in_game_name || '', req.user.id]
    );
    const result = await pool.query(
      `SELECT id, name, phone, game_uid, in_game_name, role, avatar_path, wallet_balance FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Upload / replace profile picture
router.put('/me/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });
    const avatarPath = await saveUploadedImage(req.file, 'avatars');
    await pool.query('UPDATE users SET avatar_path = $1 WHERE id = $2', [avatarPath, req.user.id]);
    const result = await pool.query(
      `SELECT id, name, phone, game_uid, in_game_name, role, avatar_path, wallet_balance FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Remove profile picture
router.delete('/me/avatar', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET avatar_path = NULL WHERE id = $1', [req.user.id]);
    const result = await pool.query(
      `SELECT id, name, phone, game_uid, in_game_name, role, avatar_path, wallet_balance FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Change password
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Set or change the security question — requires the current password so an
// attacker who briefly grabs a logged-in session can't quietly swap it out.
router.put('/me/security-question', requireAuth, async (req, res) => {
  try {
    const { current_password, security_question, security_answer } = req.body;
    if (!current_password || !security_question || !security_answer) {
      return res.status(400).json({ error: 'Current password, a question and an answer are all required.' });
    }
    if (security_answer.trim().length < 2) {
      return res.status(400).json({ error: 'Security answer is too short.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const answerHash = bcrypt.hashSync(security_answer.trim().toLowerCase(), 10);
    await pool.query(
      'UPDATE users SET security_question = $1, security_answer_hash = $2 WHERE id = $3',
      [security_question.trim(), answerHash, req.user.id]
    );
    res.json({ success: true, security_question: security_question.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Save payout details (wallet or bank account) collected right after registration
router.put('/payout-details', requireAuth, async (req, res) => {
  try {
    const { payout_method, payout_provider, payout_account_name, payout_account_number } = req.body;
    if (!payout_method || !payout_provider || !payout_account_name || !payout_account_number) {
      return res.status(400).json({ error: 'All payout detail fields are required.' });
    }
    await pool.query(
      `UPDATE users SET payout_method=$1, payout_provider=$2, payout_account_name=$3, payout_account_number=$4 WHERE id=$5`,
      [payout_method, payout_provider, payout_account_name, payout_account_number, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
