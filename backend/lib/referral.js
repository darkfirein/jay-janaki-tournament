const { pool } = require('../db');
const { notifyUser } = require('./notify');

// Flat bonus amounts (NPR) — kept simple and non-configurable on purpose,
// since making these settings would also need abuse limits (max referrals/day etc).
const REFERRER_BONUS = 30;
const REFERRED_BONUS = 20;

// Called when a tournament is marked 'completed' — checks every approved
// player in it for referral eligibility. Credits both sides of a referral
// exactly once, and only once the referred user has actually PLAYED a
// completed tournament (not merely had a payment approved) — so someone
// can't top up their wallet, join, and farm the bonus without ever playing.
async function creditReferralBonusIfEligible(io, userId) {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user || !user.referred_by || user.referral_bonus_credited) return;

    const playedCountResult = await pool.query(
      `SELECT COUNT(*)::int c FROM bookings b JOIN tournaments t ON t.id = b.tournament_id
       WHERE b.user_id = $1 AND b.status = 'approved' AND t.status = 'completed'`,
      [userId]
    );
    if (playedCountResult.rows[0].c < 1) return; // hasn't actually played a completed match yet

    // Atomic claim: flips the flag only if it's still false. If this fires for
    // more than one of the user's tournaments around the same time, only one
    // caller wins this update — so the bonus can never be paid twice.
    const claim = await pool.query(
      `UPDATE users SET referral_bonus_credited = true WHERE id = $1 AND referral_bonus_credited = false RETURNING id`,
      [userId]
    );
    if (claim.rows.length === 0) return;

    const referrerResult = await pool.query('SELECT * FROM users WHERE id = $1', [user.referred_by]);
    const referrer = referrerResult.rows[0];
    if (!referrer) return;

    await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [REFERRER_BONUS, referrer.id]);
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, note)
       VALUES ($1,'referral_bonus','wallet',$2,'completed',$3)`,
      [referrer.id, REFERRER_BONUS, `Referral bonus — ${user.name} joined using your code`]
    );

    await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [REFERRED_BONUS, user.id]);
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, note)
       VALUES ($1,'referral_bonus','wallet',$2,'completed',$3)`,
      [user.id, REFERRED_BONUS, `Welcome bonus for joining via ${referrer.name}'s referral`]
    );

    if (io) {
      await notifyUser(io, referrer.id, {
        title: 'Referral bonus! 🎁',
        body: `रू ${REFERRER_BONUS} added to your wallet — ${user.name} just played their first tournament.`,
        type: 'referral_bonus',
        link: '/wallet'
      });
      await notifyUser(io, user.id, {
        title: 'Welcome bonus! 🎁',
        body: `रू ${REFERRED_BONUS} added to your wallet for joining via a referral.`,
        type: 'referral_bonus',
        link: '/wallet'
      });
    }
  } catch (err) {
    // Never let a referral-bonus hiccup break the booking-approval flow itself.
    console.error('Referral bonus error:', err);
  }
}

module.exports = { creditReferralBonusIfEligible, REFERRER_BONUS, REFERRED_BONUS };
