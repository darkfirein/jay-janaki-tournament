const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { saveUploadedImage, isAllowedImageMime } = require('../lib/uploads');

const router = express.Router();

const uploadDepositScreenshot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ---------- eSewa (ePay v2) config ----------
const ESEWA_MODE = process.env.ESEWA_MODE || 'test';
// EPAYTEST / this key are eSewa's own published sandbox test credentials — fine as defaults for testing.
// Replace with your real merchant code + secret key (from your eSewa merchant dashboard) before going live.
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
const ESEWA_FORM_URL = ESEWA_MODE === 'live'
  ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
  : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_STATUS_URL = ESEWA_MODE === 'live'
  ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
  : 'https://rc.esewa.com.np/api/epay/transaction/status/';

// ---------- Khalti (ePayment v2) config ----------
const KHALTI_MODE = process.env.KHALTI_MODE || 'test';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_INITIATE_URL = KHALTI_MODE === 'live'
  ? 'https://khalti.com/api/v2/epayment/initiate/'
  : 'https://a.khalti.com/api/v2/epayment/initiate/';
const KHALTI_LOOKUP_URL = KHALTI_MODE === 'live'
  ? 'https://khalti.com/api/v2/epayment/lookup/'
  : 'https://a.khalti.com/api/v2/epayment/lookup/';

// ---------- Wallet summary ----------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
    const txResult = await pool.query(
      'SELECT id, type, method, amount, status, note, reference, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ balance: userResult.rows[0]?.wallet_balance || 0, transactions: txResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Manual "Scan & Pay" deposit (site's own QR + UTR, admin-reviewed) ----------
// Same flow as tournament entry-fee payments: the player scans the admin's
// static payment QR, sends the money themselves, then submits a reference
// number + screenshot as proof. Nothing is credited to the wallet yet — an
// admin reviews it in the Deposits panel and approves or rejects it, exactly
// like a withdrawal request but in reverse.
router.post('/deposit/manual', requireAuth, uploadDepositScreenshot.single('screenshot'), async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const utr = (req.body.utr || '').trim();
    if (!amount || amount < 10) return res.status(400).json({ error: 'Enter a valid amount (minimum NPR 10).' });
    if (!utr) return res.status(400).json({ error: 'Enter the UTR / transaction reference number.' });
    if (!req.file) return res.status(400).json({ error: 'Upload your payment screenshot.' });

    // Friendly early check — the unique index below is the real guarantee
    // (this just avoids uploading the screenshot to Cloudinary/disk first
    // when we can already tell the request will be rejected).
    const dupeCheck = await pool.query(
      `SELECT id FROM wallet_transactions
       WHERE type = 'deposit' AND method = 'manual' AND status IN ('pending', 'completed') AND reference = $1`,
      [utr]
    );
    if (dupeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This UTR / transaction number has already been used for a deposit. Each transaction can only be claimed once.' });
    }

    const screenshotPath = await saveUploadedImage(req.file, 'wallet-deposits');

    let result;
    try {
      result = await pool.query(
        `INSERT INTO wallet_transactions (user_id, type, method, amount, status, reference, note, screenshot_path)
         VALUES ($1,'deposit','manual',$2,'pending',$3,'Scan & Pay — awaiting admin review',$4) RETURNING *`,
        [req.user.id, amount, utr, screenshotPath]
      );
    } catch (insertErr) {
      // Catches the rare race where two requests with the same UTR land at
      // almost the same moment and both pass the check above — the unique
      // index (error code 23505) is the actual source of truth.
      if (insertErr.code === '23505') {
        return res.status(400).json({ error: 'This UTR / transaction number has already been used for a deposit. Each transaction can only be claimed once.' });
      }
      throw insertErr;
    }

    res.json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- eSewa deposit ----------
router.post('/deposit/esewa/initiate', requireAuth, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10) return res.status(400).json({ error: 'Enter a valid amount (minimum NPR 10).' });

    const transaction_uuid = `wallet-${req.user.id}-${Date.now()}`;
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, reference)
       VALUES ($1,'deposit','esewa',$2,'pending',$3)`,
      [req.user.id, amount, transaction_uuid]
    );

    const total_amount = amount.toFixed(2);
    const signed_field_names = 'total_amount,transaction_uuid,product_code';
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`;
    const signature = crypto.createHmac('sha256', ESEWA_SECRET_KEY).update(message).digest('base64');

    res.json({
      form_url: ESEWA_FORM_URL,
      fields: {
        amount: total_amount,
        tax_amount: '0',
        total_amount,
        transaction_uuid,
        product_code: ESEWA_PRODUCT_CODE,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: `${FRONTEND_URL}/wallet/esewa/callback`,
        failure_url: `${FRONTEND_URL}/wallet?deposit=failed`,
        signed_field_names,
        signature
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start eSewa payment.' });
  }
});

// Called by the frontend callback page after eSewa redirects back
router.post('/deposit/esewa/verify', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { transaction_uuid } = req.body;
    if (!transaction_uuid) return res.status(400).json({ error: 'Missing transaction reference.' });

    const txResult = await client.query(
      `SELECT * FROM wallet_transactions WHERE reference = $1 AND user_id = $2 AND type='deposit' AND method='esewa'`,
      [transaction_uuid, req.user.id]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
    if (tx.status === 'completed') {
      const u = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
      return res.json({ success: true, balance: u.rows[0].wallet_balance, already: true });
    }

    const statusUrl = `${ESEWA_STATUS_URL}?product_code=${ESEWA_PRODUCT_CODE}&total_amount=${Number(tx.amount).toFixed(2)}&transaction_uuid=${transaction_uuid}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();

    if (statusData.status === 'COMPLETE') {
      await client.query('BEGIN');
      // Atomic compare-and-swap: only the request that actually flips pending->completed
      // gets to credit the wallet, even if verify is called twice at the same time.
      const flipped = await client.query(
        `UPDATE wallet_transactions SET status='completed' WHERE id = $1 AND status != 'completed' RETURNING *`,
        [tx.id]
      );
      if (flipped.rows.length === 0) {
        await client.query('ROLLBACK');
        const u = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
        return res.json({ success: true, balance: u.rows[0].wallet_balance, already: true });
      }
      const updated = await client.query(
        `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
        [tx.amount, req.user.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, balance: updated.rows[0].wallet_balance });
    }

    await client.query(
      `UPDATE wallet_transactions SET status = $1 WHERE id = $2`,
      [statusData.status === 'PENDING' ? 'pending' : 'failed', tx.id]
    );
    res.json({ success: false, status: statusData.status || 'UNKNOWN' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Could not verify eSewa payment.' });
  } finally {
    client.release();
  }
});

// ---------- Khalti deposit ----------
router.post('/deposit/khalti/initiate', requireAuth, async (req, res) => {
  try {
    if (!KHALTI_SECRET_KEY) {
      return res.status(500).json({ error: 'Khalti is not set up yet. Add KHALTI_SECRET_KEY in the backend .env file.' });
    }
    const amount = Number(req.body.amount);
    if (!amount || amount < 10) return res.status(400).json({ error: 'Enter a valid amount (minimum NPR 10).' });

    const purchase_order_id = `wallet-${req.user.id}-${Date.now()}`;
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, reference)
       VALUES ($1,'deposit','khalti',$2,'pending',$3)`,
      [req.user.id, amount, purchase_order_id]
    );

    const userResult = await pool.query('SELECT name, phone FROM users WHERE id = $1', [req.user.id]);
    const u = userResult.rows[0];

    const khaltiRes = await fetch(KHALTI_INITIATE_URL, {
      method: 'POST',
      headers: { Authorization: `Key ${KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        return_url: `${FRONTEND_URL}/wallet/khalti/callback`,
        website_url: FRONTEND_URL,
        amount: Math.round(amount * 100), // Khalti expects paisa
        purchase_order_id,
        purchase_order_name: 'Wallet top-up',
        customer_info: { name: u.name, phone: u.phone || undefined }
      })
    });
    const data = await khaltiRes.json();

    if (!khaltiRes.ok) {
      await pool.query(`UPDATE wallet_transactions SET status='failed' WHERE reference = $1`, [purchase_order_id]);
      return res.status(400).json({ error: data.detail || 'Khalti could not start this payment.' });
    }

    // Store the pidx so the callback can look this transaction up
    await pool.query(`UPDATE wallet_transactions SET reference = $1 WHERE reference = $2`, [data.pidx, purchase_order_id]);

    res.json({ payment_url: data.payment_url, pidx: data.pidx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start Khalti payment.' });
  }
});

router.post('/deposit/khalti/verify', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { pidx } = req.body;
    if (!pidx) return res.status(400).json({ error: 'Missing transaction reference.' });

    const txResult = await client.query(
      `SELECT * FROM wallet_transactions WHERE reference = $1 AND user_id = $2 AND type='deposit' AND method='khalti'`,
      [pidx, req.user.id]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
    if (tx.status === 'completed') {
      const u = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
      return res.json({ success: true, balance: u.rows[0].wallet_balance, already: true });
    }

    const lookupRes = await fetch(KHALTI_LOOKUP_URL, {
      method: 'POST',
      headers: { Authorization: `Key ${KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidx })
    });
    const data = await lookupRes.json();

    if (data.status === 'Completed') {
      await client.query('BEGIN');
      const flipped = await client.query(
        `UPDATE wallet_transactions SET status='completed' WHERE id = $1 AND status != 'completed' RETURNING *`,
        [tx.id]
      );
      if (flipped.rows.length === 0) {
        await client.query('ROLLBACK');
        const u = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
        return res.json({ success: true, balance: u.rows[0].wallet_balance, already: true });
      }
      const updated = await client.query(
        `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
        [tx.amount, req.user.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, balance: updated.rows[0].wallet_balance });
    }

    await client.query(
      `UPDATE wallet_transactions SET status = $1 WHERE id = $2`,
      [data.status === 'Pending' ? 'pending' : 'failed', tx.id]
    );
    res.json({ success: false, status: data.status || 'Unknown' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Could not verify Khalti payment.' });
  } finally {
    client.release();
  }
});

// ---------- Withdrawals ----------
// eSewa/Khalti don't offer instant-payout APIs to regular merchants, so a withdrawal
// is recorded as a request; the admin sends the money manually and marks it complete.
router.post('/withdraw', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const amount = Number(req.body.amount);
    const { method, account_number, account_name } = req.body;
    if (!amount || amount < 50) return res.status(400).json({ error: 'Minimum withdrawal is NPR 50.' });
    if (amount > 1000) return res.status(400).json({ error: 'Maximum withdrawal is NPR 1000 per request.' });
    if (!method || !account_number || !account_name) {
      return res.status(400).json({ error: 'Payout method, account number and account name are required.' });
    }

    await client.query('BEGIN');
    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const balance = Number(userResult.rows[0].wallet_balance);
    if (balance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    // Limit to 3 withdrawal requests per rolling 24 hours per user. The row
    // lock taken just above naturally serializes concurrent requests from
    // the same person, so this count is safe from race conditions even if
    // two requests land at almost the same moment.
    const countResult = await client.query(
      `SELECT COUNT(*)::int as c FROM wallet_transactions
       WHERE user_id = $1 AND type = 'withdraw' AND created_at >= NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );
    if (countResult.rows[0].c >= 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You can submit at most 3 withdrawal requests per day. Please try again later.' });
    }

    await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [amount, req.user.id]);
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, method, amount, status, note)
       VALUES ($1,'withdraw',$2,$3,'pending',$4)`,
      [req.user.id, method, amount, `Payout to ${account_name} (${account_number})`]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Could not submit withdrawal request.' });
  } finally {
    client.release();
  }
});

module.exports = router;
