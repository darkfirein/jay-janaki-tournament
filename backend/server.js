require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { init, pool } = require('./db');
const { JWT_SECRET, COOKIE_NAME } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const announcementRoutes = require('./routes/announcements');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');
const { notifyUsers, notifyBroadcast } = require('./lib/notify');
const { markOnline, markOffline } = require('./lib/onlineUsers');

// Shared between HTTP CORS and the socket.io handshake — a cookie-based session
// only works cross-site if the server both names the exact origin (not '*')
// and sets credentials: true, so this one function backs both.
// If FRONTEND_URL isn't set on the host, fall back to the known production
// domains rather than allowing every origin — an unset env var should never
// silently turn into "accept credentialed requests from anywhere".
const DEFAULT_ALLOWED_ORIGINS = ['https://jay-janaki-tournament.online', 'https://www.jay-janaki-tournament.online'];

function isOriginAllowed(origin) {
  if (!origin) return true; // server-to-server, curl, health-check pinger
  const configured = (process.env.FRONTEND_URL || '').split(',').map((u) => u.trim()).filter(Boolean);
  const allowed = configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  return allowed.includes(origin);
}

const app = express();
// Render (and most hosts) sit the app behind one reverse proxy — without this,
// express-rate-limit sees every visitor as the same IP (the proxy's), which would
// let one busy moment lock everyone else out of login/register.
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    methods: ['GET', 'POST'],
    credentials: true,
  }
});
app.set('io', io);

// Live chat lobby, one room per tournament — only admins and players with an
// approved booking for that tournament may join or send messages.
io.on('connection', (socket) => {
  // Verify the JWT once per connection and keep it on the socket — every
  // handler below trusts socket.user, never anything the client sends,
  // so a message's sender can never be spoofed.
  // The token now lives in an httpOnly cookie, so it's read straight off the
  // handshake's raw Cookie header (socket.io doesn't run cookie-parser for us).
  const rawCookies = socket.handshake.headers?.cookie;
  const token = rawCookies ? cookie.parse(rawCookies)[COOKIE_NAME] : null;
  if (token) {
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      socket.join(`user_${socket.user.id}`);
      markOnline(socket.user.id);
    } catch {
      socket.user = null;
    }
  }

  socket.on('disconnect', () => {
    if (socket.user) markOffline(socket.user.id);
  });

  socket.on('join_tournament_room', async (tournamentId) => {
    try {
      if (!socket.user) return socket.emit('join_denied', { reason: 'Please log in to join this chat.' });

      if (socket.user.role === 'admin') {
        socket.join(`tournament_${tournamentId}`);
        return socket.emit('join_ok');
      }

      const userCheck = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [socket.user.id]);
      if (!userCheck.rows[0] || userCheck.rows[0].is_blocked) {
        return socket.emit('join_denied', { reason: 'Your account has been blocked.' });
      }

      const result = await pool.query(
        `SELECT id FROM bookings WHERE user_id = $1 AND tournament_id = $2 AND status = 'approved'`,
        [socket.user.id, tournamentId]
      );
      if (result.rows.length === 0) {
        return socket.emit('join_denied', { reason: 'Only players with an approved booking can join this chat.' });
      }

      socket.join(`tournament_${tournamentId}`);
      socket.emit('join_ok');
    } catch (err) {
      console.error(err);
      socket.emit('join_denied', { reason: 'Could not join chat.' });
    }
  });

  socket.on('send_message', (data) => {
    if (!socket.user || !data || !data.tournamentId || !data.text || !data.text.trim()) return;
    // Only relay to a room the sender actually joined (i.e. passed the approval check above)
    if (!socket.rooms.has(`tournament_${data.tournamentId}`)) return;
    io.to(`tournament_${data.tournamentId}`).emit('receive_message', {
      tournamentId: data.tournamentId,
      sender: { id: socket.user.id, name: socket.user.name },
      text: String(data.text).slice(0, 500),
      time: new Date().toISOString()
    });
  });
});

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // required so the browser will send/accept the httpOnly auth cookie cross-site
}));

// A few defensive headers that cost nothing and don't need a new dependency.
// nosniff matters most here: it stops a browser from ever trying to guess a
// different content-type for something under /uploads than the one we set.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);

// Used by an uptime pinger (e.g. UptimeRobot / cron-job.org) to stop the free-tier
// backend from sleeping and the database from auto-suspending after idle time.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

// Generic error handler (e.g. multer file-type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;

// Checks every 30s for tournaments crossing two time-based moments:
// 1) booking_opens_at just passed -> tell everyone booking is live
// 2) match_time is within 15 minutes -> tell only players with an approved booking
// Each tournament is only notified once per moment (booking_open_notified / start_soon_notified flags).
async function runNotificationScheduler() {
  try {
    const openedNow = await pool.query(
      `SELECT id, title FROM tournaments
       WHERE booking_opens_at IS NOT NULL AND booking_opens_at <= NOW()
         AND booking_open_notified = false AND status != 'cancelled'`
    );
    for (const t of openedNow.rows) {
      await notifyBroadcast(io, {
        title: 'Booking is live! 🟢',
        body: `Booking has opened for "${t.title}". Join before slots run out.`,
        type: 'booking_open',
        link: `/tournaments/${t.id}`
      });
      await pool.query('UPDATE tournaments SET booking_open_notified = true WHERE id = $1', [t.id]);
    }

    const startingSoon = await pool.query(
      `SELECT id, title FROM tournaments
       WHERE match_time IS NOT NULL AND match_time <= NOW() + INTERVAL '15 minutes' AND match_time > NOW()
         AND start_soon_notified = false AND status != 'cancelled'`
    );
    for (const t of startingSoon.rows) {
      const approved = await pool.query(
        `SELECT user_id FROM bookings WHERE tournament_id = $1 AND status = 'approved'`,
        [t.id]
      );
      await notifyUsers(io, approved.rows.map((r) => r.user_id), {
        title: 'Match starting in 15 minutes! ⏱',
        body: `"${t.title}" kicks off soon — check your room ID and password now.`,
        type: 'match_starting',
        link: `/tournaments/${t.id}`
      });
      await pool.query('UPDATE tournaments SET start_soon_notified = true WHERE id = $1', [t.id]);
    }

    // Same idea, one day out — gives players time to plan instead of a last-minute ping.
    const startingTomorrow = await pool.query(
      `SELECT id, title FROM tournaments
       WHERE match_time IS NOT NULL AND match_time <= NOW() + INTERVAL '24 hours' AND match_time > NOW()
         AND reminder_24h_notified = false AND status != 'cancelled'`
    );
    for (const t of startingTomorrow.rows) {
      const approved = await pool.query(
        `SELECT user_id FROM bookings WHERE tournament_id = $1 AND status = 'approved'`,
        [t.id]
      );
      await notifyUsers(io, approved.rows.map((r) => r.user_id), {
        title: 'Match tomorrow! 📅',
        body: `"${t.title}" is coming up in about 24 hours — get ready.`,
        type: 'match_reminder_24h',
        link: `/tournaments/${t.id}`
      });
      await pool.query('UPDATE tournaments SET reminder_24h_notified = true WHERE id = $1', [t.id]);
    }
  } catch (err) {
    console.error('Notification scheduler error:', err);
  }
}

// Keeps recurring tournaments (daily/weekly) topped up one occurrence ahead.
// Only "template" tournaments (recurrence set, recurrence_parent_id NULL) are
// looked at directly; each template's chain is walked to find its latest
// occurrence, and a new one is cloned forward once that has passed.
async function runRecurringTournamentScheduler(io) {
  try {
    const templates = await pool.query(
      `SELECT * FROM tournaments WHERE recurrence IS NOT NULL AND recurrence_parent_id IS NULL`
    );

    for (const template of templates.rows) {
      const latestResult = await pool.query(
        `SELECT * FROM tournaments WHERE id = $1 OR recurrence_parent_id = $1 ORDER BY match_time DESC NULLS LAST LIMIT 1`,
        [template.id]
      );
      const latest = latestResult.rows[0];
      if (!latest || !latest.match_time) continue;
      if (new Date(latest.match_time).getTime() > Date.now()) continue; // next one already scheduled ahead

      const intervalMs = template.recurrence === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const nextMatchTime = new Date(new Date(latest.match_time).getTime() + intervalMs);
      const nextBookingOpensAt = latest.booking_opens_at
        ? new Date(new Date(latest.booking_opens_at).getTime() + intervalMs)
        : null;

      const created = await pool.query(
        `INSERT INTO tournaments (title, game_name, entry_fee, total_slots, match_time, booking_opens_at, map_mode, prize_pool, notes, status, banner_path, recurrence, recurrence_parent_id, rate_per_kill)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upcoming',$10,$11,$12,$13) RETURNING id, title`,
        [
          template.title, template.game_name, template.entry_fee, template.total_slots,
          nextMatchTime.toISOString(), nextBookingOpensAt ? nextBookingOpensAt.toISOString() : null,
          template.map_mode, template.prize_pool, template.notes, template.banner_path,
          template.recurrence, template.id, template.rate_per_kill
        ]
      );

      await notifyBroadcast(io, {
        title: 'New tournament added! 🎮',
        body: `"${created.rows[0].title}" (${template.game_name}) is up — same time as usual.`,
        type: 'new_tournament',
        link: `/tournaments/${created.rows[0].id}`
      });
    }
  } catch (err) {
    console.error('Recurring tournament scheduler error:', err);
  }
}

init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
      setInterval(runNotificationScheduler, 30 * 1000);
      setInterval(() => runRecurringTournamentScheduler(io), 5 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize the database:', err);
    process.exit(1);
  });
