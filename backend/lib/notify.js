const { pool } = require('../db');
const { sendPushToUser, sendPushToAll } = require('./push');

// Send a notification to one specific user (e.g. "your booking was approved").
async function notifyUser(io, userId, { title, body = '', type = 'general', link = null }) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, body, type, link) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, title, body, type, link]
  );
  const notification = result.rows[0];
  if (io) io.to(`user_${userId}`).emit('notification', notification);
  sendPushToUser(userId, { title, body, link }).catch((err) => console.error('Push failed:', err.message));
  return notification;
}

// Send a notification to a specific list of user ids (e.g. everyone with an
// approved booking for a tournament) — one DB row per user, kept simple.
async function notifyUsers(io, userIds, payload) {
  for (const id of userIds) {
    await notifyUser(io, id, payload);
  }
}

// Send a notification to every user (e.g. "a new tournament was added").
// Stored as a single row with user_id = NULL, broadcast live to every connected socket.
async function notifyBroadcast(io, { title, body = '', type = 'general', link = null }) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, body, type, link) VALUES (NULL,$1,$2,$3,$4) RETURNING *`,
    [title, body, type, link]
  );
  const notification = result.rows[0];
  if (io) io.emit('notification', notification);
  sendPushToAll({ title, body, link }).catch((err) => console.error('Push broadcast failed:', err.message));
  return notification;
}

module.exports = { notifyUser, notifyUsers, notifyBroadcast };
