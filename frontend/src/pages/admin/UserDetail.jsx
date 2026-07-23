import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get(`/admin/users/${id}`).then((res) => setUser(res.data));
  }
  useEffect(load, [id]);

  async function toggleBlock() {
    setBusy(true);
    setError('');
    try {
      await api.put(`/admin/users/${id}/${user.is_blocked ? 'unblock' : 'block'}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!confirm(`Permanently delete ${user.name}? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/admin/users/${id}`);
      navigate('/admin/users');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!user) return <ListSkeleton rows={3} />;

  const s = user.stats;
  const w = user.wallet_stats;

  return (
    <div>
      <Link to="/admin/users" className="text-sm text-white/50 hover:text-volt">&larr; Back to users</Link>

      <div className="flex items-center justify-between mt-3 mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">{user.name}</h1>
          <p className="text-white/50">Game UID: <span className="font-mono">{user.game_uid}</span>{user.in_game_name && ` · ${user.in_game_name}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`pill ${user.is_online ? 'pill-approved' : ''}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${user.is_online ? 'bg-signal animate-pulse' : 'bg-white/30'}`} />
            {user.is_online ? 'Online' : 'Offline'}
          </span>
          <span className={`pill ${user.role === 'admin' ? 'pill-approved' : 'pill-pending'}`}>{user.role}</span>
          {user.is_blocked && <span className="pill pill-rejected">Blocked</span>}
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {user.role !== 'admin' && (
        <div className="flex gap-2 mb-6">
          <button onClick={toggleBlock} disabled={busy} className="btn-secondary !py-2 !px-4 text-sm">
            {user.is_blocked ? 'Unblock user' : 'Block user'}
          </button>
          <button onClick={deleteUser} disabled={busy} className="btn-secondary !py-2 !px-4 text-sm hover:!border-danger/60 hover:!text-danger">
            Delete user
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold">{s.total_bookings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Joined</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold">{s.approved_bookings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Approved</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold text-volt">{s.wins}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Wins 🏆</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold text-volt">रू {s.total_winnings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Won</p>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-3">Wallet</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="border border-line rounded-xl p-3 text-center">
            <p className="font-mono text-lg font-bold text-volt">रू {user.wallet_balance ?? 0}</p>
            <p className="text-[10px] text-white/40 uppercase mt-1">Current Balance</p>
          </div>
          <div className="border border-line rounded-xl p-3 text-center">
            <p className="font-mono text-lg font-bold text-signal">रू {w.total_topup}</p>
            <p className="text-[10px] text-white/40 uppercase mt-1">Total Top-up</p>
          </div>
          <div className="border border-line rounded-xl p-3 text-center">
            <p className="font-mono text-lg font-bold text-flame">रू {w.total_wallet_winnings}</p>
            <p className="text-[10px] text-white/40 uppercase mt-1">Winnings Credited</p>
          </div>
          <div className="border border-line rounded-xl p-3 text-center">
            <p className="font-mono text-lg font-bold">रू {w.total_withdrawn}</p>
            <p className="text-[10px] text-white/40 uppercase mt-1">Total Withdrawn</p>
          </div>
        </div>

        {user.wallet_transactions.length === 0 ? (
          <p className="text-white/40 text-sm">No wallet transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {user.wallet_transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-t border-line pt-2 first:border-0 first:pt-0">
                <div>
                  <p className="font-semibold capitalize">{t.type.replace('_', ' ')} {t.method && <span className="text-white/40">· {t.method}</span>}</p>
                  <p className="text-xs text-white/30">{new Date(t.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono ${t.type === 'deposit' || t.type === 'winnings' || t.type === 'prize' || t.type === 'referral_bonus' ? 'text-signal' : 'text-white'}`}>
                    रू {t.amount}
                  </p>
                  <span className={`pill ${t.status === 'completed' ? 'pill-approved' : t.status === 'failed' ? 'pill-rejected' : 'pill-pending'}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-3">Contact &amp; Payout Details</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-white/40 uppercase mb-1">Phone</p>
            <p>{user.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase mb-1">Joined on</p>
            <p>{new Date(user.created_at).toLocaleDateString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase mb-1">Payout method</p>
            <p>{user.payout_method ? `${user.payout_method === 'wallet' ? '📱' : '🏦'} ${user.payout_provider}` : 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase mb-1">Account name / number</p>
            <p>{user.payout_account_name ? `${user.payout_account_name} · ${user.payout_account_number}` : '—'}</p>
          </div>
        </div>
      </div>

      <h2 className="font-display text-lg font-bold mb-3">Booking History</h2>
      {user.bookings.length === 0 && (
        <div className="card p-6 text-center text-white/50">No tournaments joined yet.</div>
      )}
      <div className="space-y-3">
        {user.bookings.map((b) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-volt uppercase font-semibold">{b.game_name}</p>
                <p className="font-semibold">{b.title}</p>
                <p className="text-xs text-white/40">UTR: {b.utr_number}</p>
              </div>
              <span className={`pill ${b.status === 'approved' ? 'pill-approved' : b.status === 'rejected' ? 'pill-rejected' : 'pill-pending'}`}>
                {b.status}
              </span>
            </div>
            {b.room_id && <p className="text-sm text-signal mt-2 font-mono">Room: {b.room_id} / {b.room_password}</p>}
            {b.is_winner === 1 && <p className="text-sm text-volt font-semibold mt-2">🏆 {b.player_rank || 'Winner'} · रू {b.winning_amount}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
