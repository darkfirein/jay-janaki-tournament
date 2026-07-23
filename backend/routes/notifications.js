const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { configured: pushConfigured } = require('../lib/push');

const router = express.Router();
router.use(requireAuth);

// The VAPID public key the frontend needs to create a push subscription.
// Not secret — it's meant to be shared with every browser.
router.get('/push-public-key', (req, res) => {
  res.json({ configured: pushConfigured, public_key: process.env.VAPID_PUBLIC_KEY || null });
});

// Called once the browser grants notification permission and creates a
// push subscription — we just store it so notify.js can push to it later.
router.post('/push-subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription.' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Called when the user turns notifications off on this device.
router.post('/push-unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Most recent notifications for the logged-in user: their personal ones
// plus every broadcast (user_id IS NULL), newest first.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, (nr.id IS NOT NULL) as is_read
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
       WHERE n.user_id = $1 OR n.user_id IS NULL
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
       WHERE (n.user_id = $1 OR n.user_id IS NULL) AND nr.id IS NULL`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1,$2)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1 FROM notifications n
       WHERE (n.user_id = $1 OR n.user_id IS NULL)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
