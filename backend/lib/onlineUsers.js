// Tracks which logged-in users currently have a live socket.io connection
// (the app opens one globally for notifications, so this is a reasonable
// proxy for "online right now"). Counts connections per user rather than a
// plain Set, since someone can have the site open in more than one tab.
const connectionsByUser = new Map(); // userId -> open connection count

function markOnline(userId) {
  if (!userId) return;
  connectionsByUser.set(userId, (connectionsByUser.get(userId) || 0) + 1);
}

function markOffline(userId) {
  if (!userId) return;
  const count = connectionsByUser.get(userId) || 0;
  if (count <= 1) connectionsByUser.delete(userId);
  else connectionsByUser.set(userId, count - 1);
}

function isOnline(userId) {
  return connectionsByUser.has(userId);
}

function onlineCount() {
  return connectionsByUser.size;
}

function onlineIdSet() {
  return new Set(connectionsByUser.keys());
}

module.exports = { markOnline, markOffline, isOnline, onlineCount, onlineIdSet };
