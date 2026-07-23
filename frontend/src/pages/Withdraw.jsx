import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { ProfileSkeleton } from '../components/SkeletonLoader.jsx';

export default function Withdraw() {
  const [balance, setBalance] = useState(null);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', method: 'esewa', account_number: '', account_name: '' });
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  function load() {
    api.get('/wallet/me').then((res) => setBalance(res.data.balance));
  }
  useEffect(load, []);

  async function submitWithdraw(e) {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess(false);
    const amt = Number(withdrawForm.amount);
    if (!amt || amt < 50) return setWithdrawError('Enter a valid amount (minimum NPR 50).');
    if (amt > 1000) return setWithdrawError('Maximum withdrawal is NPR 1000 per request.');
    if (!withdrawForm.account_number.trim()) {
      return setWithdrawError(withdrawForm.method === 'bank' ? 'Account number is required.' : 'Mobile number is required.');
    }
    setWithdrawing(true);
    try {
      await api.post('/wallet/withdraw', { ...withdrawForm, amount: amt });
      setWithdrawSuccess(true);
      setWithdrawForm({ amount: '', method: 'esewa', account_number: '', account_name: '' });
      load();
    } catch (err) {
      setWithdrawError(err.response?.data?.error || 'Could not submit withdrawal request.');
    } finally {
      setWithdrawing(false);
    }
  }

  if (balance == null) return <ProfileSkeleton />;

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Withdraw</p>
      <h1 className="font-display text-4xl font-bold mb-1">रू {balance}</h1>
      <p className="text-white/50 mb-8">Available wallet balance. Withdrawals are sent to your eSewa, Khalti, or bank account.</p>

      <div className="card p-6 mb-6">
        {withdrawError && <p className="text-danger text-sm mb-3">{withdrawError}</p>}
        {withdrawSuccess && <p className="text-signal text-sm mb-3">Withdrawal request submitted — we'll send it to your account shortly.</p>}
        <form onSubmit={submitWithdraw} className="space-y-4">
          <div>
            <label className="field-label">Amount (NPR)</label>
            <input
              type="number" min="50" max="1000" className="input"
              value={withdrawForm.amount}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
              placeholder="e.g. 200"
            />
            <p className="text-[11px] text-white/30 mt-1">Min रू50, max रू1000 per request. Up to 3 requests per day.</p>
          </div>
          <div>
            <label className="field-label">Payout method</label>
            <select
              className="input" value={withdrawForm.method}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, method: e.target.value, account_number: '' })}
            >
              <option value="esewa">eSewa</option>
              <option value="khalti">Khalti</option>
              <option value="bank">Bank transfer</option>
            </select>
          </div>
          <div>
            <label className="field-label">Account name</label>
            <input className="input" value={withdrawForm.account_name} onChange={(e) => setWithdrawForm({ ...withdrawForm, account_name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">
              {withdrawForm.method === 'bank' ? 'Bank account number' : 'Mobile number (registered on ' + (withdrawForm.method === 'khalti' ? 'Khalti' : 'eSewa') + ')'}
            </label>
            <input
              type={withdrawForm.method === 'bank' ? 'text' : 'tel'}
              inputMode={withdrawForm.method === 'bank' ? 'text' : 'numeric'}
              placeholder={withdrawForm.method === 'bank' ? 'e.g. 0123456789012' : 'e.g. 98XXXXXXXX'}
              className="input"
              value={withdrawForm.account_number}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, account_number: e.target.value })}
            />
          </div>
          <button type="submit" disabled={withdrawing} className="btn-primary w-full">
            {withdrawing ? 'Submitting…' : 'Request withdrawal'}
          </button>
        </form>
      </div>

      <Link to="/wallet" className="card p-5 flex items-center justify-between hover:border-volt/50 transition">
        <div>
          <p className="font-semibold text-sm">Go to Wallet</p>
          <p className="text-xs text-white/40 mt-0.5">Add money and see recent activity</p>
        </div>
        <span className="text-white/40">→</span>
      </Link>
    </div>
  );
}
