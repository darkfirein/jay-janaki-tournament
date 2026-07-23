import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Upload, QrCode, Maximize2, X, Download } from 'lucide-react';
import api, { fileUrl } from '../api.js';
import { ProfileSkeleton } from '../components/SkeletonLoader.jsx';

const statusLabel = { pending: 'Pending', completed: 'Completed', failed: 'Failed' };
const statusClass = { pending: 'pill-pending', completed: 'pill-approved', failed: 'pill-rejected' };

export default function Wallet() {
  const [searchParams] = useSearchParams();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [depositMethod, setDepositMethod] = useState('manual'); // 'manual' | 'gateway'
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [utr, setUtr] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState(false);
  const fileInputRef = useRef(null);

  function load() {
    api.get('/wallet/me').then((res) => {
      setBalance(res.data.balance);
      setTransactions(res.data.transactions);
      recoverPendingDeposits(res.data.transactions);
    });
    api.get('/settings').then((res) => setSettings(res.data));
  }
  useEffect(load, []);

  // If the user paid but never made it back through the callback page (closed
  // the tab, missed the "return to merchant" button, etc.), the deposit stays
  // 'pending' even though Khalti/eSewa already completed it. Re-check those here.
  async function recoverPendingDeposits(txList) {
    const pending = (txList || []).filter(
      (t) => t.type === 'deposit' && t.status === 'pending' && t.reference && (t.method === 'khalti' || t.method === 'esewa')
    );
    if (pending.length === 0) return;

    let recovered = false;
    for (const t of pending) {
      try {
        const endpoint = t.method === 'khalti' ? '/wallet/deposit/khalti/verify' : '/wallet/deposit/esewa/verify';
        const body = t.method === 'khalti' ? { pidx: t.reference } : { transaction_uuid: t.reference };
        const res = await api.post(endpoint, body);
        if (res.data.success) recovered = true;
      } catch {
        // still pending or genuinely failed — leave it, next load will retry
      }
    }
    if (recovered) {
      setNotice('A pending payment was confirmed and added to your wallet.');
      api.get('/wallet/me').then((res) => {
        setBalance(res.data.balance);
        setTransactions(res.data.transactions);
      });
    }
  }

  useEffect(() => {
    if (searchParams.get('deposit') === 'failed') setError('Payment was not completed. Please try again.');
  }, [searchParams]);

  async function payWithEsewa(e) {
    e.preventDefault();
    setError('');
    const amt = Number(depositAmount);
    if (!amt || amt < 10) return setError('Enter a valid amount (minimum NPR 10).');

    setDepositing('esewa');
    try {
      const { data } = await api.post('/wallet/deposit/esewa/initiate', { amount: amt });
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.form_url;
      Object.entries(data.fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start eSewa payment.');
      setDepositing('');
    }
  }

  async function payWithKhalti(e) {
    e.preventDefault();
    setError('');
    const amt = Number(depositAmount);
    if (!amt || amt < 10) return setError('Enter a valid amount (minimum NPR 10).');

    setDepositing('khalti');
    try {
      const { data } = await api.post('/wallet/deposit/khalti/initiate', { amount: amt });
      window.location.href = data.payment_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start Khalti payment.');
      setDepositing('');
    }
  }

  function onScreenshotPicked(file) {
    if (!file) return;
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  function handleDrop(e) {
    e.preventDefault();
    onScreenshotPicked(e.dataTransfer.files?.[0]);
  }

  async function submitManualDeposit(e) {
    e.preventDefault();
    setManualError('');
    setManualSuccess(false);

    const amt = Number(depositAmount);
    if (!amt || amt < 10) return setManualError('Enter a valid amount (minimum NPR 10).');
    if (!utr.trim()) return setManualError('Enter the UTR / transaction reference number.');
    if (!screenshotFile) return setManualError('Upload your payment screenshot.');

    setManualSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', amt);
      fd.append('utr', utr.trim());
      fd.append('screenshot', screenshotFile);
      await api.post('/wallet/deposit/manual', fd);
      setManualSuccess(true);
      setUtr('');
      setScreenshotFile(null);
      setScreenshotPreview('');
      setDepositAmount('');
      load();
    } catch (err) {
      setManualError(err.response?.data?.error || 'Could not submit deposit request.');
    } finally {
      setManualSubmitting(false);
    }
  }

  async function downloadQr() {
    if (!settings?.qr_image_path) return;
    const url = fileUrl(settings.qr_image_path);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'payment-qr.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  }

  if (balance == null) return <ProfileSkeleton />;

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Your Wallet</p>
      <h1 className="font-display text-4xl font-bold mb-1">रू {balance}</h1>
      {notice && <p className="text-signal text-sm mb-3">{notice}</p>}
      <p className="text-white/50 mb-8">Top up by scanning our QR code — then use it for tournament entry fees instantly.</p>

      <div className="card p-6 mb-6">
        <h2 className="font-display text-xl font-bold mb-4">Add money</h2>

        <div className="flex gap-2 mb-5 border-b border-line">
          <button
            type="button"
            onClick={() => setDepositMethod('manual')}
            className={`pb-3 px-1 text-sm font-semibold border-b-2 -mb-px transition flex items-center gap-1.5 ${depositMethod === 'manual' ? 'text-volt border-volt' : 'text-white/40 border-transparent hover:text-white/70'}`}
          >
            <QrCode className="w-3.5 h-3.5" /> Scan &amp; Pay
          </button>
          <button
            type="button"
            onClick={() => setDepositMethod('gateway')}
            className={`pb-3 px-1 text-sm font-semibold border-b-2 -mb-px transition flex items-center gap-1.5 ${depositMethod === 'gateway' ? 'text-volt border-volt' : 'text-white/40 border-transparent hover:text-white/70'}`}
          >
            eSewa / Khalti <span className="text-[9px] font-bold text-white/30 border border-line rounded px-1 py-0.5 normal-case">Not available now</span>
          </button>
        </div>

        <div className="mb-4">
          <label className="field-label">Amount (NPR)</label>
          <input
            type="number" min="10" className="input" value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 500"
          />
        </div>

        {depositMethod === 'gateway' ? (
          <div className="p-5 rounded-xl border border-dashed border-line text-center">
            <p className="text-sm text-white/50">eSewa and Khalti top-up isn't available right now.</p>
            <button type="button" onClick={() => setDepositMethod('manual')} className="text-xs text-volt hover:underline mt-2">
              Use Scan &amp; Pay instead →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink border border-volt/20 flex flex-col sm:flex-row items-center gap-4">
              {settings?.qr_image_path ? (
                <button
                  type="button"
                  onClick={() => setQrFullscreen(true)}
                  className="shrink-0 relative group"
                  title="Tap to view full screen"
                >
                  <img src={fileUrl(settings.qr_image_path)} alt="Payment QR code" className="w-28 h-28 rounded-xl object-cover border-2 border-volt/40" />
                  <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition">
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                  </span>
                </button>
              ) : (
                <div className="w-28 h-28 rounded-xl border border-dashed border-line flex items-center justify-center text-[10px] text-white/40 text-center p-2 shrink-0">
                  QR not uploaded yet
                </div>
              )}
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs text-white/50">
                  Scan the QR code and pay exactly{' '}
                  <span className="text-volt font-bold">रू {depositAmount || '—'}</span>.
                  {settings?.qr_image_path && <span className="block text-white/30 mt-0.5">Tap the QR to view full screen &amp; download</span>}
                </p>
                <p className="text-sm text-white/80">Account Number: <span className="font-mono">{settings?.upi_id}</span></p>
                {settings?.payment_instructions && <p className="text-xs text-white/40">{settings.payment_instructions}</p>}
              </div>
            </div>

            {manualError && <p className="text-danger text-sm">{manualError}</p>}
            {manualSuccess && <p className="text-signal text-sm">Deposit request submitted — it'll be added to your wallet once an admin verifies it.</p>}

            <form onSubmit={submitManualDeposit} className="space-y-4">
              <div>
                <label className="field-label">UTR / Transaction Reference Number</label>
                <input
                  type="text" className="input" placeholder="e.g. 302518293471"
                  value={utr} onChange={(e) => setUtr(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">Payment Screenshot</label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-line hover:border-volt/40 bg-ink/60 hover:bg-ink rounded-xl p-5 text-center cursor-pointer transition-all relative"
                >
                  <input
                    ref={fileInputRef} type="file" accept="image/*"
                    onChange={(e) => onScreenshotPicked(e.target.files?.[0])}
                    className="hidden"
                  />
                  {screenshotPreview ? (
                    <div className="space-y-2">
                      <img src={screenshotPreview} alt="Payment proof preview" className="max-h-32 mx-auto rounded-lg object-contain border border-volt/30" />
                      <p className="text-[10px] text-white/40">Click or drag to replace photo</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <div className="flex justify-center text-volt"><Upload className="w-8 h-8" /></div>
                      <p className="text-xs text-white/50">Click or drag your payment screenshot here</p>
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={manualSubmitting} className="btn-primary w-full">
                {manualSubmitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </form>
          </div>
        )}
      </div>

      <Link to="/withdraw" className="card p-5 mb-6 flex items-center justify-between hover:border-volt/50 transition">
        <div>
          <p className="font-semibold text-sm">Withdraw money</p>
          <p className="text-xs text-white/40 mt-0.5">Send your wallet balance to eSewa, Khalti, or bank</p>
        </div>
        <span className="text-white/40">→</span>
      </Link>

      <div className="card p-6">
        <h2 className="font-display text-xl font-bold mb-4">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="text-white/40 text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b border-line pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-semibold capitalize">{t.type.replace('_', ' ')} <span className="text-white/40">· {t.method}</span></p>
                  <p className="text-xs text-white/30">{new Date(t.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const isCredit = t.type === 'deposit' || ((t.type === 'winnings' || t.type === 'prize') && Number(t.amount) >= 0);
                    return (
                      <p className={`font-mono ${isCredit ? 'text-signal' : 'text-white'}`}>
                        {isCredit ? '+' : '-'}रू {Math.abs(Number(t.amount))}
                      </p>
                    );
                  })()}
                  <span className={`pill ${statusClass[t.status] || 'pill-pending'}`}>{statusLabel[t.status] || t.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {qrFullscreen && settings?.qr_image_path && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6"
          onClick={() => setQrFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setQrFullscreen(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white/50 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={fileUrl(settings.qr_image_path)}
            alt="Payment QR code"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[85vw] max-h-[65vh] rounded-2xl border-2 border-volt/40 object-contain bg-white"
          />

          {settings.upi_id && (
            <p className="text-white/70 text-sm mt-4 font-mono" onClick={(e) => e.stopPropagation()}>
              Account Number: {settings.upi_id}
            </p>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); downloadQr(); }}
            className="btn-primary !px-5 !py-2.5 mt-5 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download QR
          </button>
        </div>
      )}
    </div>
  );
}
