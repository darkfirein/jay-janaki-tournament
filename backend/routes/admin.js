const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyUser, notifyBroadcast } = require('../lib/notify');
const { runOcr, parseKillLines, parseNameLines, matchPlayers } = require('../lib/vision');
const { creditReferralBonusIfEligible } = require('../lib/referral');
const { saveUploadedImage, isAllowedImageMime } = require('../lib/uploads');
const { onlineCount, onlineIdSet } = require('../lib/onlineUsers');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---------- Dashboard ----------
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = (await pool.query(`SELECT COUNT(*)::int c FROM users WHERE role = 'user'`)).rows[0].c;
    const totalTournaments = (await pool.query('SELECT COUNT(*)::int c FROM tournaments')).rows[0].c;
    const pendingBookings = (await pool.query(`SELECT COUNT(*)::int c FROM bookings WHERE status = 'pending'`)).rows[0].c;
    const approvedBookings = (await pool.query(`SELECT COUNT(*)::int c FROM bookings WHERE status = 'approved'`)).rows[0].c;
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(t.entry_fee), 0)::float r
       FROM bookings b JOIN tournaments t ON t.id = b.tournament_id
       WHERE b.status = 'approved'`
    );
    const revenue = revenueResult.rows[0].r;

    res.json({ totalUsers, totalTournaments, pendingBookings, approvedBookings, revenue, onlineUsers: onlineCount() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Tournaments (CRUD) ----------
const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

// Includes how many approved players are waiting for room details, per tournament
router.get('/tournaments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.tournament_id = t.id AND b.status = 'approved') as approved_count,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.tournament_id = t.id AND b.status = 'approved' AND (b.room_id IS NULL OR b.room_id = '')) as waiting_count
      FROM tournaments t
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/tournaments/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.tournament_id = t.id AND b.status = 'approved') as approved_count,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.tournament_id = t.id AND b.status = 'approved' AND (b.room_id IS NULL OR b.room_id = '')) as waiting_count
      FROM tournaments t
      WHERE t.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tournament not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/tournaments', uploadBanner.single('banner'), async (req, res) => {
  try {
    const { title, game_name, entry_fee, total_slots, match_time, booking_opens_at, map_mode, match_type, prize_pool, notes, status, recurrence } = req.body;
    if (!title || !game_name || entry_fee == null || !total_slots) {
      return res.status(400).json({ error: 'Title, game name, entry fee and total slots are required.' });
    }
    const bannerPath = req.file ? await saveUploadedImage(req.file, 'tournaments') : null;
    const validRecurrence = ['daily', 'weekly'].includes(recurrence) ? recurrence : null;
    const result = await pool.query(
      `INSERT INTO tournaments (title, game_name, entry_fee, total_slots, match_time, booking_opens_at, map_mode, match_type, prize_pool, notes, status, banner_path, recurrence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [title, game_name, Number(entry_fee), parseInt(total_slots, 10), match_time || null, booking_opens_at || null, map_mode || '', match_type || '', prize_pool || '', notes || '', status || 'upcoming', bannerPath, validRecurrence]
    );
    const created = await pool.query('SELECT * FROM tournaments WHERE id = $1', [result.rows[0].id]);
    const t = created.rows[0];

    if (t.status !== 'cancelled') {
      await notifyBroadcast(req.app.get('io'), {
        title: 'New tournament added! 🎮',
        body: `"${t.title}" (${t.game_name}) — entry रू ${t.entry_fee}. Check it out.`,
        type: 'new_tournament',
        link: `/tournaments/${t.id}`
      });
    }

    res.json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/tournaments/:id', uploadBanner.single('banner'), async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Tournament not found.' });

    const updated = { ...existing, ...req.body };

    // Banner precedence: a freshly uploaded file wins; otherwise "remove_banner"
    // (sent as the string "true" from FormData) clears it; otherwise keep as-is.
    let bannerPath = existing.banner_path;
    if (req.file) {
      bannerPath = await saveUploadedImage(req.file, 'tournaments');
    } else if (req.body.remove_banner === 'true') {
      bannerPath = null;
    }

    await pool.query(
      `UPDATE tournaments SET title=$1, game_name=$2, entry_fee=$3, total_slots=$4, match_time=$5, booking_opens_at=$6, map_mode=$7, match_type=$8, prize_pool=$9, notes=$10, status=$11, result_note=$12, banner_path=$13, recurrence=$14
       WHERE id = $15`,
      [
        updated.title, updated.game_name, Number(updated.entry_fee), parseInt(updated.total_slots, 10),
        updated.match_time || null, updated.booking_opens_at || null, updated.map_mode, updated.match_type, updated.prize_pool, updated.notes, updated.status, updated.result_note || '', bannerPath,
        ['daily', 'weekly'].includes(updated.recurrence) ? updated.recurrence : null,
        req.params.id
      ]
    );
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [req.params.id]);

    // A referred player's bonus (and their referrer's) only unlocks once they've
    // actually played a match — this is the one place a tournament flips to
    // 'completed', so it's the right spot to check everyone who played it.
    if (existing.status !== 'completed' && updated.status === 'completed') {
      const io = req.app.get('io');
      const approved = await pool.query(
        `SELECT user_id FROM bookings WHERE tournament_id = $1 AND status = 'approved'`,
        [req.params.id]
      );
      for (const row of approved.rows) {
        await creditReferralBonusIfEligible(io, row.user_id);
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.delete('/tournaments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE tournament_id = $1', [req.params.id]);
    await pool.query('DELETE FROM tournaments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Send (or resend) room ID + password to every approved player of a tournament at once
router.put('/tournaments/:id/release-room', async (req, res) => {
  try {
    const { room_id, room_password } = req.body;
    if (!room_id || !room_password) {
      return res.status(400).json({ error: 'Room ID and password are required.' });
    }
    const result = await pool.query(
      `UPDATE bookings SET room_id=$1, room_password=$2, updated_at=NOW()
       WHERE tournament_id=$3 AND status='approved'
       RETURNING id`,
      [room_id, room_password, req.params.id]
    );
    res.json({ success: true, updated_count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Bookings (approve / reject / winner) ----------
router.get('/bookings', async (req, res) => {
  try {
    const { status, tournament_id } = req.query;
    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`b.status = $${params.length}`);
    }
    if (tournament_id) {
      params.push(tournament_id);
      conditions.push(`b.tournament_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT b.*, u.name as user_name, u.phone as user_phone, u.game_uid, u.in_game_name,
              u.payout_method, u.payout_provider, u.payout_account_name, u.payout_account_number,
              t.title, t.game_name, t.entry_fee, t.match_time
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN tournaments t ON t.id = b.tournament_id
       ${where}
       ORDER BY b.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Verifies payment only — room details are sent later, in bulk, via release-room
router.put('/bookings/:id/approve', async (req, res) => {
  try {
    const { admin_note } = req.body;
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    await pool.query(
      `UPDATE bookings SET status='approved', admin_note=$1, updated_at=NOW() WHERE id=$2`,
      [admin_note || '', req.params.id]
    );

    if (booking.status !== 'approved') {
      await pool.query('UPDATE tournaments SET filled_slots = filled_slots + 1 WHERE id = $1', [booking.tournament_id]);
      const io = req.app.get('io');
      if (io) io.to(`tournament_${booking.tournament_id}`).emit('slot_update', { tournamentId: String(booking.tournament_id) });

      const tResult = await pool.query('SELECT title FROM tournaments WHERE id = $1', [booking.tournament_id]);
      await notifyUser(io, booking.user_id, {
        title: 'Booking approved! ✅',
        body: `You're confirmed for "${tResult.rows[0]?.title || 'the tournament'}". Room details will appear in My Bookings closer to match time.`,
        type: 'booking_approved',
        link: '/my-bookings'
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/bookings/:id/reject', async (req, res) => {
  try {
    const { admin_note } = req.body;
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    await pool.query(
      `UPDATE bookings SET status='rejected', admin_note=$1, updated_at=NOW() WHERE id=$2`,
      [admin_note || 'Payment could not be verified.', req.params.id]
    );

    // If this booking had already been approved (and counted toward the
    // tournament's filled slots), rejecting it now must free that slot back up
    // — otherwise the tournament stays stuck at "full" for no real reason.
    if (booking.status === 'approved') {
      await pool.query(
        'UPDATE tournaments SET filled_slots = GREATEST(filled_slots - 1, 0) WHERE id = $1',
        [booking.tournament_id]
      );
      const io = req.app.get('io');
      if (io) io.to(`tournament_${booking.tournament_id}`).emit('slot_update', { tournamentId: String(booking.tournament_id) });
    }

    const tResult = await pool.query('SELECT title FROM tournaments WHERE id = $1', [booking.tournament_id]);
    await notifyUser(req.app.get('io'), booking.user_id, {
      title: 'Booking rejected',
      body: `Your payment for "${tResult.rows[0]?.title || 'the tournament'}" could not be verified.${admin_note ? ` Reason: ${admin_note}` : ''}`,
      type: 'booking_rejected',
      link: '/my-bookings'
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Declare or update a winner (rank + prize amount) for an approved booking.
// The prize amount is credited straight to the player's wallet — if the amount
// or winner status is changed later, only the difference is adjusted so the
// wallet always matches what's currently recorded as won.
router.put('/bookings/:id/winner', async (req, res) => {
  const client = await pool.connect();
  try {
    const { is_winner, winning_amount, player_rank } = req.body;
    const newAmount = Number(winning_amount) || 0;
    const newIsWinner = is_winner ? 1 : 0;

    await client.query('BEGIN');

    const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]);
    const booking = bookingResult.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only approved bookings can be marked as winners.' });
    }

    const oldCredited = booking.is_winner ? Number(booking.winning_amount) || 0 : 0;
    const newCredited = newIsWinner ? newAmount : 0;
    const delta = newCredited - oldCredited;

    await client.query(
      `UPDATE bookings SET is_winner=$1, winning_amount=$2, player_rank=$3, updated_at=NOW() WHERE id=$4`,
      [newIsWinner, newAmount, player_rank || '', req.params.id]
    );

    if (delta !== 0) {
      await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [delta, booking.user_id]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, method, amount, status, note)
         VALUES ($1,'winnings','wallet',$2,'completed',$3)`,
        [booking.user_id, delta, delta >= 0 ? 'Tournament winnings credited' : 'Winner amount/status adjusted']
      );
    }

    await client.query('COMMIT');

    if (newIsWinner && delta > 0) {
      const tResult = await pool.query('SELECT title FROM tournaments WHERE id = $1', [booking.tournament_id]);
      await notifyUser(req.app.get('io'), booking.user_id, {
        title: 'You won! 🏆',
        body: `${player_rank ? `${player_rank} in` : 'Winner of'} "${tResult.rows[0]?.title || 'the tournament'}" — रू ${newAmount} has been added to your wallet!`,
        type: 'winner',
        link: '/wallet'
      });
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

// ---------- Users ----------
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.role, u.created_at, u.game_uid, u.in_game_name, u.is_blocked, u.wallet_balance,
              u.payout_method, u.payout_provider, u.payout_account_name, u.payout_account_number,
              COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'completed'), 0)::float as total_topup,
              COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE user_id = u.id AND type IN ('winnings','prize') AND status = 'completed'), 0)::float as total_winnings
       FROM users u ORDER BY u.created_at DESC`
    );

    const onlineIds = onlineIdSet();
    const users = result.rows.map((u) => ({ ...u, is_online: onlineIds.has(u.id) }));

    const totalsResult = await pool.query(`
      SELECT
        COUNT(*)::int as total_users,
        COALESCE((SELECT SUM(wallet_balance) FROM users), 0)::float as total_wallet_balance,
        COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE type = 'deposit' AND status = 'completed'), 0)::float as total_topup,
        COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE type IN ('winnings','prize') AND status = 'completed'), 0)::float as total_winnings
      FROM users
    `);

    res.json({ users, totals: { ...totalsResult.rows[0], online_count: onlineCount() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Full detail for one user: profile + payout info + their full booking history
router.get('/users/:id', async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, name, phone, role, created_at, game_uid, in_game_name, is_blocked, wallet_balance,
              payout_method, payout_provider, payout_account_name, payout_account_number
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const bookingsResult = await pool.query(
      `SELECT b.id, b.status, b.utr_number, b.screenshot_path, b.room_id, b.room_password,
              b.admin_note, b.is_winner, b.winning_amount, b.player_rank, b.created_at,
              t.title, t.game_name, t.entry_fee, t.match_time
       FROM bookings b
       JOIN tournaments t ON t.id = b.tournament_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.params.id]
    );

    const statsResult = await pool.query(
      `SELECT
         COUNT(*)::int as total_bookings,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)::int as approved_bookings,
         COALESCE(SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END), 0)::int as wins,
         COALESCE(SUM(CASE WHEN is_winner = 1 THEN winning_amount ELSE 0 END), 0)::float as total_winnings
       FROM bookings WHERE user_id = $1`,
      [req.params.id]
    );

    const walletStatsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END), 0)::float as total_topup,
         COALESCE(SUM(CASE WHEN type IN ('winnings','prize') AND status = 'completed' THEN amount ELSE 0 END), 0)::float as total_wallet_winnings,
         COALESCE(SUM(CASE WHEN type = 'withdraw' AND status = 'completed' THEN amount ELSE 0 END), 0)::float as total_withdrawn,
         COALESCE(SUM(CASE WHEN type = 'referral_bonus' AND status = 'completed' THEN amount ELSE 0 END), 0)::float as total_referral_bonus
       FROM wallet_transactions WHERE user_id = $1`,
      [req.params.id]
    );

    const walletTxResult = await pool.query(
      `SELECT id, type, method, amount, status, reference, created_at
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );

    res.json({
      ...user,
      is_online: onlineIdSet().has(user.id),
      stats: statsResult.rows[0],
      bookings: bookingsResult.rows,
      wallet_stats: walletStatsResult.rows[0],
      wallet_transactions: walletTxResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Block a user — they're logged out on their next request and can't log back in
router.put('/users/:id/block', async (req, res) => {
  try {
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    if (target.rows[0].role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be blocked.' });

    await pool.query('UPDATE users SET is_blocked = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/users/:id/unblock', async (req, res) => {
  try {
    const result = await pool.query('UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Permanently delete a user. Only allowed when they have no booking or wallet
// history, so tournament records and payment history are never silently lost —
// block the account instead if it has any history.
router.delete('/users/:id', async (req, res) => {
  try {
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    if (target.rows[0].role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be deleted.' });

    const bookingCheck = await pool.query('SELECT id FROM bookings WHERE user_id = $1 LIMIT 1', [req.params.id]);
    const walletCheck = await pool.query('SELECT id FROM wallet_transactions WHERE user_id = $1 LIMIT 1', [req.params.id]);
    if (bookingCheck.rows.length > 0 || walletCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This user has booking or payment history and cannot be deleted — block them instead.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Settings (site QR code, account number, rules, contact) ----------
const uploadQr = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

// ---------- Kill results (Google Vision OCR -> auto kill-bonus payout) ----------
// This screenshot is only ever read for OCR, never stored or shown to anyone,
// so it stays in memory and is never written to disk or Cloudinary.
const uploadResultShot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

// Pre-match roll call: upload a screenshot of the in-game room/lobby and
// check which approved players are actually visible in it, matched by
// in-game nickname. Read-only — nothing is written to the DB, this is
// purely a checklist for the admin before releasing room ID/password.
router.post('/tournaments/:id/room-check', uploadResultShot.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a room/lobby screenshot.' });

    const tResult = await pool.query('SELECT id, title FROM tournaments WHERE id = $1', [req.params.id]);
    if (!tResult.rows[0]) return res.status(404).json({ error: 'Tournament not found.' });

    const text = await runOcr(req.file.buffer);
    const candidates = parseNameLines(text);

    const playersResult = await pool.query(
      `SELECT b.id as booking_id, b.user_id, u.in_game_name, u.name as user_name, u.game_uid
       FROM bookings b JOIN users u ON u.id = b.user_id
       WHERE b.tournament_id = $1 AND b.status = 'approved'`,
      [req.params.id]
    );

    const matched = matchPlayers(playersResult.rows, candidates);
    const results = matched.map((p) => ({
      booking_id: p.booking_id,
      user_id: p.user_id,
      user_name: p.user_name,
      in_game_name: p.in_game_name,
      game_uid: p.game_uid,
      matched: p.matched,
      matched_text: p.matched_text
    }));

    res.json({
      results,
      total: results.length,
      matched_count: results.filter((r) => r.matched).length,
      raw_text: text
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'NO_VISION_KEY') {
      return res.status(400).json({ error: 'Google Vision API key is not set up yet. Add GOOGLE_VISION_API_KEY in backend/.env.' });
    }
    res.status(500).json({ error: err.message || 'Could not read the screenshot.' });
  }
});

// Step 1: OCR the screenshot and match extracted names against approved
// players. This is a PREVIEW ONLY — no wallet money moves here, so a bad
// OCR read never silently pays the wrong person.
router.post('/tournaments/:id/results/scan', uploadResultShot.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a results screenshot.' });

    const tResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [req.params.id]);
    const tournament = tResult.rows[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });

    const rateOverride = Number(req.body.rate_per_kill);
    const ratePerKill = rateOverride > 0 ? rateOverride : tournament.rate_per_kill;
    if (!ratePerKill || ratePerKill <= 0) {
      return res.status(400).json({ error: 'Set a rate per kill (रू) for this tournament first.' });
    }

    const text = await runOcr(req.file.buffer);
    const candidates = parseKillLines(text);

    const playersResult = await pool.query(
      `SELECT b.id as booking_id, b.user_id, b.kill_bonus_paid, u.in_game_name, u.name as user_name
       FROM bookings b JOIN users u ON u.id = b.user_id
       WHERE b.tournament_id = $1 AND b.status = 'approved'`,
      [req.params.id]
    );

    const matched = matchPlayers(playersResult.rows, candidates);
    const results = matched.map((p) => ({
      booking_id: p.booking_id,
      user_id: p.user_id,
      user_name: p.user_name,
      in_game_name: p.in_game_name,
      matched: p.matched,
      matched_text: p.matched_text,
      already_paid: p.kill_bonus_paid,
      kills: p.kills,
      amount: p.kills * ratePerKill
    }));

    res.json({ rate_per_kill: ratePerKill, raw_text: text, results });
  } catch (err) {
    console.error(err);
    if (err.code === 'NO_VISION_KEY') {
      return res.status(400).json({ error: 'Google Vision API key is not set up yet. Add GOOGLE_VISION_API_KEY in backend/.env.' });
    }
    res.status(500).json({ error: err.message || 'Could not read the screenshot.' });
  }
});

// Step 2: admin has reviewed/edited the preview — actually credit wallets now.
router.post('/tournaments/:id/results/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    const { results, rate_per_kill } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'No results to confirm.' });
    }

    await client.query('BEGIN');
    const tResult = await client.query('SELECT title FROM tournaments WHERE id = $1', [req.params.id]);
    const title = tResult.rows[0]?.title || 'the tournament';

    if (rate_per_kill > 0) {
      await client.query('UPDATE tournaments SET rate_per_kill = $1 WHERE id = $2', [rate_per_kill, req.params.id]);
    }

    const paid = [];
    const skipped = [];

    for (const r of results) {
      const kills = Number(r.kills) || 0;
      const amount = Number(r.amount) || 0;

      const bookingResult = await client.query(
        `SELECT * FROM bookings WHERE id = $1 AND tournament_id = $2 FOR UPDATE`,
        [r.booking_id, req.params.id]
      );
      const booking = bookingResult.rows[0];
      if (!booking || booking.status !== 'approved') { skipped.push(r.booking_id); continue; }
      if (booking.kill_bonus_paid) { skipped.push(r.booking_id); continue; } // already paid — never double-pay
      if (amount <= 0) { skipped.push(r.booking_id); continue; }

      await client.query(
        `UPDATE bookings SET kill_count = $1, kill_bonus_amount = $2, kill_bonus_paid = true WHERE id = $3`,
        [kills, amount, booking.id]
      );
      await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, booking.user_id]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, method, amount, status, reference, note)
         VALUES ($1, 'prize', 'kill_bonus', $2, 'completed', $3, $4)`,
        [booking.user_id, amount, `tournament_${req.params.id}`, `${kills} kills in "${title}"`]
      );
      paid.push({ booking_id: booking.id, user_id: booking.user_id, kills, amount });
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    for (const p of paid) {
      await notifyUser(io, p.user_id, {
        title: 'Kill bonus credited! 🎯',
        body: `You got ${p.kills} kills in "${title}" — रू ${p.amount} added to your wallet.`,
        type: 'kill_bonus',
        link: '/wallet'
      });
    }

    res.json({ success: true, paid_count: paid.length, skipped_count: skipped.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while paying out results.' });
  } finally {
    client.release();
  }
});

router.put('/settings', uploadQr.single('qr_image'), async (req, res) => {
  try {
    const {
      site_name, upi_id, payment_instructions, rules_text, contact_note, contact_email, contact_phone, auto_approve_max_amount,
      hero_badge, hero_quote, hero_heading_line1, hero_heading_line2, hero_heading_highlight, hero_paragraph,
      hero_stat1_value, hero_stat1_label, hero_stat2_value, hero_stat2_label, hero_stat3_value, hero_stat3_label, hero_cta_text
    } = req.body;

    async function upsert(key, value) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=excluded.value',
        [key, value]
      );
    }

    if (site_name != null) await upsert('site_name', site_name);
    if (upi_id != null) await upsert('upi_id', upi_id);
    if (payment_instructions != null) await upsert('payment_instructions', payment_instructions);
    if (rules_text != null) await upsert('rules_text', rules_text);
    if (contact_note != null) await upsert('contact_note', contact_note);
    if (contact_email != null) await upsert('contact_email', contact_email);
    if (contact_phone != null) await upsert('contact_phone', contact_phone);
    if (auto_approve_max_amount != null) await upsert('auto_approve_max_amount', String(Number(auto_approve_max_amount) || 0));
    if (hero_badge != null) await upsert('hero_badge', hero_badge);
    if (hero_quote != null) await upsert('hero_quote', hero_quote);
    if (hero_heading_line1 != null) await upsert('hero_heading_line1', hero_heading_line1);
    if (hero_heading_line2 != null) await upsert('hero_heading_line2', hero_heading_line2);
    if (hero_heading_highlight != null) await upsert('hero_heading_highlight', hero_heading_highlight);
    if (hero_paragraph != null) await upsert('hero_paragraph', hero_paragraph);
    if (hero_stat1_value != null) await upsert('hero_stat1_value', hero_stat1_value);
    if (hero_stat1_label != null) await upsert('hero_stat1_label', hero_stat1_label);
    if (hero_stat2_value != null) await upsert('hero_stat2_value', hero_stat2_value);
    if (hero_stat2_label != null) await upsert('hero_stat2_label', hero_stat2_label);
    if (hero_stat3_value != null) await upsert('hero_stat3_value', hero_stat3_value);
    if (hero_stat3_label != null) await upsert('hero_stat3_label', hero_stat3_label);
    if (hero_cta_text != null) await upsert('hero_cta_text', hero_cta_text);
    if (req.file) await upsert('qr_image_path', await saveUploadedImage(req.file, 'settings'));

    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach((r) => (settings[r.key] = r.value));
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Home page content (announcements / photos / news) ----------
const uploadAnnouncementImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/announcements', uploadAnnouncementImage.single('image'), async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required.' });

    const imagePath = req.file ? await saveUploadedImage(req.file, 'announcements') : null;
    const result = await pool.query(
      'INSERT INTO announcements (title, body, image_path) VALUES ($1,$2,$3) RETURNING *',
      [title, body || '', imagePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Wallet withdrawals ----------
router.get('/withdrawals', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = `WHERE wt.type = 'withdraw'`;
    if (status) {
      params.push(status);
      where += ` AND wt.status = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT wt.*, u.name as user_name, u.phone as user_phone
       FROM wallet_transactions wt
       JOIN users u ON u.id = wt.user_id
       ${where}
       ORDER BY wt.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/withdrawals/:id/complete', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE wallet_transactions SET status='completed' WHERE id=$1 AND type='withdraw' AND status='pending' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'This request was not found or has already been processed.' });
    }

    await notifyUser(req.app.get('io'), result.rows[0].user_id, {
      title: 'Withdrawal sent 💸',
      body: `Your withdrawal of रू ${result.rows[0].amount} has been sent.`,
      type: 'withdrawal_completed',
      link: '/wallet'
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Reject a withdrawal and refund the amount back to the user's wallet
router.put('/withdrawals/:id/reject', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txResult = await client.query(
      `SELECT * FROM wallet_transactions WHERE id=$1 AND type='withdraw' FOR UPDATE`,
      [req.params.id]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }
    if (tx.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request has already been processed.' });
    }
    await client.query(`UPDATE wallet_transactions SET status='failed', note = COALESCE(note,'') || ' (rejected — refunded)' WHERE id=$1`, [tx.id]);
    await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id=$2', [tx.amount, tx.user_id]);
    await client.query('COMMIT');

    await notifyUser(req.app.get('io'), tx.user_id, {
      title: 'Withdrawal rejected',
      body: `Your withdrawal request of रू ${tx.amount} was rejected and refunded to your wallet.`,
      type: 'withdrawal_rejected',
      link: '/wallet'
    });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

// ---------- Manual "Scan & Pay" deposit requests ----------
router.get('/deposits', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = `WHERE wt.type = 'deposit' AND wt.method = 'manual'`;
    if (status) {
      params.push(status);
      where += ` AND wt.status = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT wt.*, u.name as user_name, u.phone as user_phone, u.game_uid
       FROM wallet_transactions wt
       JOIN users u ON u.id = wt.user_id
       ${where}
       ORDER BY wt.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/deposits/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txResult = await client.query(
      `SELECT * FROM wallet_transactions WHERE id=$1 AND type='deposit' AND method='manual' FOR UPDATE`,
      [req.params.id]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deposit request not found.' });
    }
    if (tx.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This request has already been processed.' });
    }

    await client.query(`UPDATE wallet_transactions SET status='completed' WHERE id=$1`, [tx.id]);
    await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id=$2', [tx.amount, tx.user_id]);
    await client.query('COMMIT');

    await notifyUser(req.app.get('io'), tx.user_id, {
      title: 'Deposit approved 💰',
      body: `रू ${tx.amount} has been added to your wallet.`,
      type: 'deposit_approved',
      link: '/wallet'
    });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

router.put('/deposits/:id/reject', async (req, res) => {
  try {
    const { admin_note } = req.body;
    const result = await pool.query(
      `UPDATE wallet_transactions SET status='failed', note = $1 WHERE id=$2 AND type='deposit' AND method='manual' AND status='pending' RETURNING *`,
      [admin_note || 'Payment could not be verified.', req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'This request was not found or has already been processed.' });
    }

    await notifyUser(req.app.get('io'), result.rows[0].user_id, {
      title: 'Deposit rejected',
      body: `Your deposit of रू ${result.rows[0].amount} could not be verified.${admin_note ? ` Reason: ${admin_note}` : ''}`,
      type: 'deposit_rejected',
      link: '/wallet'
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Analytics (charts on the admin Analytics page) ----------
router.get('/analytics', async (req, res) => {
  try {
    const revenueByDay = await pool.query(`
      SELECT to_char(b.created_at, 'YYYY-MM-DD') as day, COALESCE(SUM(t.entry_fee), 0)::float as revenue
      FROM bookings b JOIN tournaments t ON t.id = b.tournament_id
      WHERE b.status = 'approved' AND b.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day ASC
    `);
    const gamePopularity = await pool.query(`
      SELECT t.game_name, COUNT(*)::int as bookings
      FROM bookings b JOIN tournaments t ON t.id = b.tournament_id
      WHERE b.status = 'approved'
      GROUP BY t.game_name ORDER BY bookings DESC
    `);
    const statusCounts = await pool.query(`SELECT status, COUNT(*)::int as count FROM tournaments GROUP BY status`);
    const repeatVsNew = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE approved_count = 1)::int as one_time_players,
        COUNT(*) FILTER (WHERE approved_count > 1)::int as repeat_players
      FROM (
        SELECT user_id, COUNT(*) as approved_count FROM bookings WHERE status = 'approved' GROUP BY user_id
      ) x
    `);

    res.json({
      revenueByDay: revenueByDay.rows,
      gamePopularity: gamePopularity.rows,
      statusCounts: statusCounts.rows,
      repeatVsNew: repeatVsNew.rows[0] || { one_time_players: 0, repeat_players: 0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- CSV export ----------
function toCsv(rows, columns) {
  const escape = (val) => {
    if (val == null) return '';
    let str = String(val).replace(/"/g, '""');
    // Neutralize CSV/formula injection: if a cell starts with =, +, -, or @,
    // Excel/Sheets can interpret it as a formula when the file is opened.
    // A leading tab keeps the visible value intact but stops it from executing.
    if (/^[=+\-@]/.test(str)) str = '\t' + str;
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

router.get('/export/bookings.csv', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, u.name as user_name, u.game_uid, t.title as tournament_title, t.entry_fee,
             b.status, b.utr_number, b.room_id, b.is_winner, b.winning_amount, b.created_at
      FROM bookings b JOIN users u ON u.id = b.user_id JOIN tournaments t ON t.id = b.tournament_id
      ORDER BY b.created_at DESC
    `);
    const csv = toCsv(result.rows, [
      { key: 'id', label: 'Booking ID' }, { key: 'user_name', label: 'Player' }, { key: 'game_uid', label: 'Game UID' },
      { key: 'tournament_title', label: 'Tournament' }, { key: 'entry_fee', label: 'Entry Fee' }, { key: 'status', label: 'Status' },
      { key: 'utr_number', label: 'UTR' }, { key: 'room_id', label: 'Room ID' }, { key: 'is_winner', label: 'Is Winner' },
      { key: 'winning_amount', label: 'Winning Amount' }, { key: 'created_at', label: 'Created At' }
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/export/withdrawals.csv', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wt.id, u.name as user_name, u.game_uid, wt.amount, wt.method, wt.reference, wt.status, wt.note, wt.created_at
      FROM wallet_transactions wt JOIN users u ON u.id = wt.user_id
      WHERE wt.type = 'withdraw'
      ORDER BY wt.created_at DESC
    `);
    const csv = toCsv(result.rows, [
      { key: 'id', label: 'ID' }, { key: 'user_name', label: 'Player' }, { key: 'game_uid', label: 'Game UID' },
      { key: 'amount', label: 'Amount' }, { key: 'method', label: 'Method' }, { key: 'reference', label: 'Account' },
      { key: 'status', label: 'Status' }, { key: 'note', label: 'Note' }, { key: 'created_at', label: 'Created At' }
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="withdrawals.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/export/users.csv', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, game_uid, phone, in_game_name, wallet_balance, is_blocked, created_at
      FROM users WHERE role = 'user' ORDER BY created_at DESC
    `);
    const csv = toCsv(result.rows, [
      { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'game_uid', label: 'Game UID' },
      { key: 'phone', label: 'Phone' }, { key: 'in_game_name', label: 'In-game Nickname' },
      { key: 'wallet_balance', label: 'Wallet Balance' }, { key: 'is_blocked', label: 'Blocked' }, { key: 'created_at', label: 'Joined' }
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Failed-login monitoring ----------
router.get('/login-attempts', async (req, res) => {
  try {
    const recent = await pool.query(`SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT 100`);
    // Flags any Game UID / IP combo with 3+ failures in the last 24 hours as suspicious
    const suspicious = await pool.query(`
      SELECT game_uid, ip, COUNT(*)::int as fail_count, MAX(created_at) as last_attempt
      FROM login_attempts
      WHERE success = false AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY game_uid, ip
      HAVING COUNT(*) >= 3
      ORDER BY fail_count DESC
    `);
    res.json({ recent: recent.rows, suspicious: suspicious.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Player reviews ----------
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await pool.query(`
      SELECT r.*, u.name as user_name, t.title as tournament_title
      FROM reviews r JOIN users u ON u.id = r.user_id JOIN tournaments t ON t.id = r.tournament_id
      ORDER BY r.created_at DESC LIMIT 100
    `);
    const averages = await pool.query(`
      SELECT t.id as tournament_id, t.title, ROUND(AVG(r.rating)::numeric, 1)::float as avg_rating, COUNT(*)::int as review_count
      FROM reviews r JOIN tournaments t ON t.id = r.tournament_id
      GROUP BY t.id, t.title ORDER BY avg_rating DESC
    `);
    res.json({ reviews: reviews.rows, averages: averages.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
