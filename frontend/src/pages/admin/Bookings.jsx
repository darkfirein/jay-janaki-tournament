import React, { useEffect, useState } from 'react';
import api, { fileUrl, downloadCsv } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

const tabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' }
];

export default function Bookings() {
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState([]);
  const [winnerOpenId, setWinnerOpenId] = useState(null);
  const [winnerForm, setWinnerForm] = useState({ player_rank: '', winning_amount: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get(`/admin/bookings?status=${tab}`).then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [tab]);

  async function approve(id) {
    try {
      await api.put(`/admin/bookings/${id}/approve`, {});
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not approve.');
    }
  }

  async function reject(id) {
    const note = prompt('Reason for rejection (shown to the player):', 'Payment could not be verified.');
    if (note === null) return;
    await api.put(`/admin/bookings/${id}/reject`, { admin_note: note });
    load();
  }

  function openWinner(b) {
    setWinnerOpenId(b.id);
    setWinnerForm({ player_rank: b.player_rank || '', winning_amount: b.winning_amount || '' });
    setError('');
  }

  async function markWinner(id) {
    if (!winnerForm.winning_amount) return setError('Enter the winning amount.');
    try {
      await api.put(`/admin/bookings/${id}/winner`, {
        is_winner: true,
        player_rank: winnerForm.player_rank,
        winning_amount: Number(winnerForm.winning_amount)
      });
      setWinnerOpenId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark as winner.');
    }
  }

  async function unmarkWinner(id) {
    await api.put(`/admin/bookings/${id}/winner`, { is_winner: false, winning_amount: 0, player_rank: '' });
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl font-bold">Payment Approvals</h1>
        <button onClick={() => downloadCsv('/admin/export/bookings.csv', 'bookings.csv')} className="btn-secondary !py-2 !px-3 text-sm shrink-0">
          Export CSV
        </button>
      </div>
      <p className="text-white/50 mb-6">
        Check the UTR and screenshot, then approve. Room ID &amp; password are sent later to
        everyone at once from the <strong>Tournaments</strong> page.
      </p>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t.key ? 'bg-volt text-white' : 'bg-panel text-white/60 border border-line'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <ListSkeleton rows={3} />}
      {!loading && list.length === 0 && <div className="card p-8 text-center text-white/50">No {tab} bookings.</div>}

      <div className="space-y-4">
        {!loading && list.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <p className="text-xs text-volt uppercase font-semibold">{b.game_name}</p>
                <p className="font-semibold">{b.title}</p>
                <p className="text-sm text-white/50 mt-1">{b.user_name} · {b.game_uid}{b.in_game_name && ` · ${b.in_game_name}`} · {b.user_phone}</p>
                <p className="text-sm text-white/50">UTR: <span className="font-mono text-white/80">{b.utr_number}</span></p>
                {b.status === 'approved' && b.room_id && (
                  <p className="text-sm text-signal mt-1 font-mono">Room sent: {b.room_id} / {b.room_password}</p>
                )}
                {b.status === 'approved' && !b.room_id && (
                  <p className="text-sm text-warn mt-1">Waiting — room not sent yet</p>
                )}
                {b.is_winner === 1 && (
                  <p className="text-sm text-volt mt-1 font-semibold">🏆 Winner{b.player_rank ? ` — ${b.player_rank}` : ''} · रू {b.winning_amount}</p>
                )}
                {b.status === 'rejected' && (
                  <p className="text-sm text-danger mt-1">{b.admin_note}</p>
                )}
                {b.payout_method && (
                  <p className="text-xs text-white/40 mt-1">
                    Payout: {b.payout_method === 'wallet' ? '📱' : '🏦'} {b.payout_provider} · {b.payout_account_name} · {b.payout_account_number}
                  </p>
                )}
              </div>

              {b.screenshot_path && (
                <a href={fileUrl(b.screenshot_path)} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={fileUrl(b.screenshot_path)} alt="Payment screenshot" className="w-24 h-24 object-cover rounded-xl border border-line hover:border-volt/50 transition" />
                </a>
              )}
            </div>

            {tab === 'pending' && (
              <div className="mt-4 pt-4 border-t border-line flex gap-2">
                <button onClick={() => approve(b.id)} className="btn-primary !py-2 !px-4 text-sm">Approve</button>
                <button onClick={() => reject(b.id)} className="btn-secondary !py-2 !px-4 text-sm hover:!border-danger/60 hover:!text-danger">Reject</button>
              </div>
            )}

            {tab === 'approved' && (
              <div className="mt-4 pt-4 border-t border-line">
                {winnerOpenId === b.id ? (
                  <div className="space-y-3">
                    {error && <p className="text-danger text-sm">{error}</p>}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="input" placeholder="Rank (e.g. 1st place)" value={winnerForm.player_rank} onChange={(e) => setWinnerForm({ ...winnerForm, player_rank: e.target.value })} />
                      <input className="input" type="number" min="0" placeholder="Winning amount (रू)" value={winnerForm.winning_amount} onChange={(e) => setWinnerForm({ ...winnerForm, winning_amount: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => markWinner(b.id)} className="btn-primary !py-2 !px-4 text-sm">Confirm winner</button>
                      <button onClick={() => setWinnerOpenId(null)} className="btn-secondary !py-2 !px-4 text-sm">Cancel</button>
                    </div>
                  </div>
                ) : b.is_winner === 1 ? (
                  <button onClick={() => unmarkWinner(b.id)} className="btn-secondary !py-2 !px-4 text-sm hover:!border-danger/60 hover:!text-danger">Remove winner status</button>
                ) : (
                  <button onClick={() => openWinner(b)} className="btn-primary !py-2 !px-4 text-sm">🏆 Mark as winner</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
