const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// List all tournaments that are not cancelled, soonest match first
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, game_name, entry_fee, total_slots, filled_slots, match_time, booking_opens_at, map_mode, match_type, prize_pool, status, notes, banner_path
       FROM tournaments
       WHERE status != 'cancelled'
       ORDER BY match_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Completed tournaments with their declared winners — public results board
router.get('/results/all', async (req, res) => {
  try {
    const tResult = await pool.query(
      `SELECT id, title, game_name, match_time, prize_pool, result_note
       FROM tournaments
       WHERE status = 'completed'
       ORDER BY match_time DESC`
    );

    const results = [];
    for (const t of tResult.rows) {
      const wResult = await pool.query(
        `SELECT b.player_rank, b.winning_amount, u.name as winner_name
         FROM bookings b JOIN users u ON u.id = b.user_id
         WHERE b.tournament_id = $1 AND b.is_winner = 1
         ORDER BY b.player_rank ASC`,
        [t.id]
      );
      results.push({ ...t, winners: wResult.rows });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Public leaderboard — top players by total winnings, then win count.
// Only counts approved bookings; admin accounts are excluded.
router.get('/leaderboard/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.in_game_name,
        COUNT(b.id)::int as tournaments_played,
        COALESCE(SUM(CASE WHEN b.is_winner = 1 THEN 1 ELSE 0 END), 0)::int as wins,
        COALESCE(SUM(CASE WHEN b.is_winner = 1 THEN b.winning_amount ELSE 0 END), 0)::float as total_winnings
      FROM users u
      JOIN bookings b ON b.user_id = u.id AND b.status = 'approved'
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.in_game_name
      HAVING COUNT(b.id) > 0
      ORDER BY total_winnings DESC, wins DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tournament not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
