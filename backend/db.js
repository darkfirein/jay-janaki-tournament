const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Add a Postgres connection string as an environment variable.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      avatar_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      game_name TEXT NOT NULL,
      entry_fee REAL NOT NULL,
      total_slots INTEGER NOT NULL,
      filled_slots INTEGER NOT NULL DEFAULT 0,
      match_time TEXT,
      map_mode TEXT,
      match_type TEXT,
      prize_pool TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      notes TEXT,
      result_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      utr_number TEXT,
      screenshot_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      room_id TEXT,
      room_password TEXT,
      admin_note TEXT,
      is_winner INTEGER NOT NULL DEFAULT 0,
      winning_amount REAL NOT NULL DEFAULT 0,
      player_rank TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      image_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      method TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reference TEXT,
      note TEXT,
      screenshot_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT,
      type TEXT NOT NULL DEFAULT 'general',
      link TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // user_id = NULL means a broadcast notification meant for everyone

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // One row per device/browser a user has enabled notifications on — a
  // person can have several (phone + laptop), each gets pushed to separately.

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER NOT NULL REFERENCES notifications(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      read_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (notification_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, tournament_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      game_uid TEXT,
      ip TEXT,
      success BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Safe migrations for anyone upgrading an existing database
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance REAL NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_note TEXT;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_winner INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS winning_amount REAL NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS player_rank TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_method TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_provider TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_number TEXT;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS game_uid TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS in_game_name TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_game_uid_key ON users (game_uid);`);
  // Prevents double-submitting the same tournament (e.g. double-tapping "join") from
  // ever creating two live bookings — rejected attempts don't count, so a user can
  // still retry after a rejection.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_tournament_active_key ON bookings (user_id, tournament_id) WHERE status != 'rejected';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;`);
  // Security question, used as the primary identity check on forgot-password.
  // Nullable so existing accounts (registered before this feature) keep working —
  // the forgot-password route falls back to name+phone for those users until they set one.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_path TEXT;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS booking_opens_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS booking_open_notified BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_soon_notified BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rate_per_kill REAL NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kill_count INTEGER;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kill_bonus_amount REAL NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kill_bonus_paid BOOLEAN NOT NULL DEFAULT false;`);

  // --- Referral system ---
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_bonus_credited BOOLEAN NOT NULL DEFAULT false;`);

  // --- 24-hour-before reminder (separate from the existing 15-minute one) ---
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reminder_24h_notified BOOLEAN NOT NULL DEFAULT false;`);

  // --- Recurring tournaments: recurrence is set only on the "template" tournament;
  // clones point back to it via recurrence_parent_id so the scheduler can find the chain.
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS recurrence TEXT;`);
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS recurrence_parent_id INTEGER REFERENCES tournaments(id);`);

  // --- Auto-approve small UTR payments using the same OCR used for kill-count bonuses ---
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;`);

  // --- Solo / Duo / Squad match mode, set separately from the map name ---
  await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS match_type TEXT;`);

  // --- Profile picture ---
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT;`);

  // --- Manual "Scan & Pay" wallet top-up proof screenshot ---
  await pool.query(`ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS screenshot_path TEXT;`);

  // A real bank/eSewa/Khalti UTR is unique per transaction, so the same
  // reference number should never fund a wallet twice — whether that's one
  // person resubmitting the same screenshot or someone reusing a UTR they
  // saw leaked somewhere. This only blocks reuse while a request is still
  // pending or already approved; a rejected one (e.g. a typo) frees the
  // number back up so the player can correct and resubmit it.
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS wallet_deposit_utr_unique
      ON wallet_transactions (reference)
      WHERE type = 'deposit' AND method = 'manual' AND status IN ('pending', 'completed');
    `);
  } catch (err) {
    // If duplicate UTRs already exist in the data (shouldn't normally happen),
    // don't let that crash the whole server on boot — just log it so it can
    // be cleaned up manually. New submissions are still checked in-app.
    console.error('Could not create wallet_deposit_utr_unique index:', err.message);
  }

  await seedAdmin();
  await seedSettings();
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || null;
  const gameUid = (process.env.ADMIN_GAME_UID || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const name = process.env.ADMIN_NAME || 'Admin';

  const { rows } = await pool.query('SELECT id FROM users WHERE game_uid = $1', [gameUid]);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync(password, 10);
    try {
      await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role, game_uid) VALUES ($1,$2,$3,$4,$5,$6)',
        [name, email, '', hash, 'admin', gameUid]
      );
      console.log(`Admin account created -> Game UID: ${gameUid}  password: ${password}`);
      console.log('IMPORTANT: log in and change this password / update env vars before going live.');
    } catch (err) {
      console.error('Could not create admin account (it may already exist under a different Game UID):', err.message);
    }
  }
}

async function seedSettings() {
  const defaults = {
    site_name: 'Jay Janaki Tournament Centre',
    upi_id: 'yourupi@bank',
    qr_image_path: '',
    payment_instructions: 'Scan the QR code or pay to the account number above, then enter your UTR number and upload a screenshot as proof.',
    rules_text: '1. Fair play only — no hacks, emulators (for mobile-only games), or teaming with rivals.\n2. Room ID and password are for your use only — do not share them.\n3. Be in the lobby at least 10 minutes before match time.\n4. Entry fees are non-refundable once a room ID has been issued.\n5. Decisions made by the admin regarding winners and disputes are final.',
    contact_note: 'Have a question about a payment, a match, or anything else? Reach out — we usually reply within a few hours.',
    contact_email: 'support@example.com',
    contact_phone: '+91 00000 00000',
    auto_approve_max_amount: '0',
    hero_badge: "Nepal's Prestige Gaming Hub",
    hero_quote: 'Game timi khela, paise hami dinchham!',
    hero_heading_line1: "Nepal's Ultimate",
    hero_heading_line2: 'Battleground:',
    hero_heading_highlight: 'Claim Your Glory!',
    hero_paragraph: "Stop grinding for free. Drop into Nepal's fiercest real-money gaming arena, wipe out the lobby with your squad, and cash out instantly via eSewa & Khalti. Your phone, your squad, your victory. Slots are filling fast!",
    hero_stat1_value: 'Rs. 10L+',
    hero_stat1_label: 'Monthly Prizes',
    hero_stat2_value: 'Instant',
    hero_stat2_label: 'eSewa & Khalti',
    hero_stat3_value: '100%',
    hero_stat3_label: 'Anti-Cheat Safe',
    hero_cta_text: 'Start Winning Now'
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }
}

module.exports = { pool, init };
