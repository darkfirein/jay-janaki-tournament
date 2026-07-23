const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { runOcr } = require('../lib/vision');
const { saveUploadedImage, isAllowedImageMime } = require('../lib/uploads');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error('Only image files are allowed for payment screenshots.'));
    }
    cb(null, true);
  }
});

// Create a new booking (join a tournament with payment proof)
router.post('/', requireAuth, upload.single('screenshot'), async (req, res) => {
  // Manual QR + UTR screenshot payment for tournament entry fees has been
  // retired — entry is now wallet-only (see POST /bookings/wallet-pay).
  // The route stays here (rather than being deleted) so a stale client or
  // direct API call gets a clear explanation instead of a confusing 404.
  return res.status(410).json({
    error: 'Manual QR payment for tournament entry is no longer available. Please pay from your wallet instead — top up your wallet first if needed.'
  });

  try {
    const { tournament_id, utr_number } = req.body;
    if (!tournament_id || !utr_number) {
      return res.status(400).json({ error: 'Tournament and UTR number are required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a payment screenshot.' });
    }

    const tResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournament_id]);
    const tournament = tResult.rows[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
    if (tournament.filled_slots >= tournament.total_slots) {
      return res.status(400).json({ error: 'This tournament is already full.' });
    }
    if (tournament.booking_opens_at && new Date(tournament.booking_opens_at).getTime() > Date.now()) {
      return res.status(400).json({ error: 'Booking has not opened for this tournament yet.' });
    }

    const already = await pool.query(
      `SELECT id FROM bookings WHERE user_id = $1 AND tournament_id = $2 AND status != 'rejected'`,
      [req.user.id, tournament_id]
    );
    if (already.rows.length > 0) {
      return res.status(409).json({ error: 'You have already joined this tournament.' });
    }

    // Small entry fees can be auto-approved instantly if the UTR number typed by the
    // player can be read straight off their screenshot via OCR — same Vision API
    // already used for kill-count bonuses. Any failure here (no API key, OCR error,
    // no match) just falls back to the normal manual-review queue, silently.
    let autoApproved = false;
    try {
      const settingResult = await pool.query(`SELECT value FROM settings WHERE key = 'auto_approve_max_amount'`);
      const maxAmount = Number(settingResult.rows[0]?.value || 0);
      if (maxAmount > 0 && Number(tournament.entry_fee) <= maxAmount && process.env.GOOGLE_VISION_API_KEY) {
        const text = await runOcr(req.file.buffer);
        const textDigits = text.replace(/\D/g, '');
        const textLower = text.toLowerCase();
        const typedDigits = utr_number.replace(/\D/g, '');

        // Real UTR/transaction IDs are long (10+ digits) — a short match is too
        // likely to be a coincidental number elsewhere in an unrelated image.
        // Also require the exact entry fee amount and a recognizable payment-app
        // keyword to show up in the same screenshot, so a random image with a
        // matching number can't be used to skip payment entirely.
        const hasLongDigitMatch = typedDigits.length >= 10 && textDigits.includes(typedDigits);
        const hasAmountMatch = textDigits.includes(String(Math.round(Number(tournament.entry_fee))));
        const hasPaymentKeyword = /esewa|khalti|successful|transaction/.test(textLower);

        if (hasLongDigitMatch && hasAmountMatch && hasPaymentKeyword) {
          autoApproved = true;
        }
      }
    } catch (ocrErr) {
      console.error('Auto-approve OCR check failed (falling back to manual review):', ocrErr.message);
    }

    const screenshotPath = await saveUploadedImage(req.file, 'screenshots');
    const status = autoApproved ? 'approved' : 'pending';
    const result = await pool.query(
      `INSERT INTO bookings (user_id, tournament_id, utr_number, screenshot_path, status, auto_approved)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user.id, tournament_id, utr_number, screenshotPath, status, autoApproved]
    );

    if (autoApproved) {
      await pool.query('UPDATE tournaments SET filled_slots = filled_slots + 1 WHERE id = $1', [tournament_id]);
      const io = req.app.get('io');
      if (io) io.to(`tournament_${tournament_id}`).emit('slot_update', { tournamentId: String(tournament_id) });
    }

    res.json({ id: result.rows[0].id, status, auto_approved: autoApproved });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already joined this tournament.' });
    }
    res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
});

// Current user's bookings, with tournament info joined in
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.status, b.utr_number, b.screenshot_path, b.room_id, b.room_password,
              b.admin_note, b.created_at, b.is_winner, b.winning_amount, b.player_rank,
              t.id as tournament_id, t.title, t.game_name, t.entry_fee, t.match_time, t.status as tournament_status, t.result_note
       FROM bookings b
       JOIN tournaments t ON t.id = b.tournament_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Join a tournament instantly using wallet balance — skips manual screenshot verification
router.post('/wallet-pay', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tournament_id } = req.body;
    if (!tournament_id) return res.status(400).json({ error: 'Tournament is required.' });

    await client.query('BEGIN');

    const tResult = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [tournament_id]);
    const tournament = tResult.rows[0];
    if (!tournament) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tournament not found.' });
    }
    if (tournament.filled_slots >= tournament.total_slots) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This tournament is already full.' });
    }
    if (tournament.booking_opens_at && new Date(tournament.booking_opens_at).getTime() > Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking has not opened for this tournament yet.' });
    }

    const already = await client.query(
      `SELECT id FROM bookings WHERE user_id = $1 AND tournament_id = $2 AND status != 'rejected'`,
      [req.user.id, tournament_id]
    );
    if (already.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You have already joined this tournament.' });
    }

    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const balance = Number(userResult.rows[0].wallet_balance);
    const entryFee = Number(tournament.entry_fee);
    if (balance < entryFee) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance. Please top up your wallet first.' });
    }

    await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [entryFee, req.user.id]);
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, note)
       VALUES ($1,'entry_fee','wallet',$2,'completed',$3)`,
      [req.user.id, entryFee, `Entry fee for "${tournament.title}"`]
    );

    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, tournament_id, utr_number, status)
       VALUES ($1,$2,'WALLET','approved') RETURNING id`,
      [req.user.id, tournament_id]
    );
    await client.query('UPDATE tournaments SET filled_slots = filled_slots + 1 WHERE id = $1', [tournament_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.to(`tournament_${tournament_id}`).emit('slot_update', { tournamentId: String(tournament_id) });

    res.json({ id: bookingResult.rows[0].id, status: 'approved' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already joined this tournament.' });
    }
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

// Submit (or update) a 1-5 star rating + optional comment for a completed
// tournament — only allowed for players with an approved booking in it.
router.post('/:id/review', requireAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const stars = Number(rating);
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const bookingResult = await pool.query(
      `SELECT b.id FROM bookings b JOIN tournaments t ON t.id = b.tournament_id
       WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'approved' AND t.status = 'completed'`,
      [req.params.id, req.user.id]
    );
    const booking = bookingResult.rows[0];
    if (!booking) return res.status(404).json({ error: 'No completed booking found to review.' });

    const tIdResult = await pool.query('SELECT tournament_id FROM bookings WHERE id = $1', [req.params.id]);
    const tournamentId = tIdResult.rows[0].tournament_id;

    await pool.query(
      `INSERT INTO reviews (user_id, tournament_id, rating, comment)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, tournament_id) DO UPDATE SET rating = $3, comment = $4`,
      [req.user.id, tournamentId, stars, comment || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// The current user's own reviews, keyed by tournament — lets the frontend show
// "you already reviewed this" instead of the rating form again.
router.get('/reviews/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT tournament_id, rating, comment FROM reviews WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
