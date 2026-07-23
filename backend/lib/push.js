const webpush = require('web-push');
const { pool } = require('../db');

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Pushes one notification payload to every device a user has enabled
// notifications on. Best-effort: a device that's uninstalled the app or
// revoked permission will make the push service return 404/410, and we
// quietly delete that subscription row so we stop wasting pushes on it.
async function sendPushToUser(userId, { title, body = '', link = null }) {
  if (!configured) return;

  const subsResult = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  if (subsResult.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, link });

  await Promise.all(subsResult.rows.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    try {
      await webpush.sendNotification(pushSubscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
      } else {
        console.error('Push send failed:', err.message);
      }
    }
  }));
}

// Broadcasts to every subscribed device across every user — used for
// site-wide announcements (new tournament, etc). Same best-effort cleanup.
async function sendPushToAll({ title, body = '', link = null }) {
  if (!configured) return;

  const subsResult = await pool.query('SELECT * FROM push_subscriptions');
  if (subsResult.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, link });

  await Promise.all(subsResult.rows.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    try {
      await webpush.sendNotification(pushSubscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
      } else {
        console.error('Push send failed:', err.message);
      }
    }
  }));
}

module.exports = { configured, sendPushToUser, sendPushToAll };
