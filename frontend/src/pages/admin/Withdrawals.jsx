import React, { useEffect, useState } from 'react';
import api, { downloadCsv } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

export default function Withdrawals() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/withdrawals').then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function complete(id) {
    if (!confirm('Confirm that you have sent this payout?')) return;
    await api.put(`/admin/withdrawals/${id}/complete`);
    load();
  }

  async function reject(id) {
    if (!confirm('Reject this request? The amount will be refunded to the user\'s wallet.')) return;
    await api.put(`/admin/withdrawals/${id}/reject`);
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl font-bold">Withdrawal Requests</h1>
        <button onClick={() => downloadCsv('/admin/export/withdrawals.csv', 'withdrawals.csv')} className="btn-secondary !py-2 !px-3 text-sm shrink-0">
          Export CSV
        </button>
      </div>
      <p className="text-white/50 mb-6">Send the payout manually via eSewa/Khalti/bank, then mark it complete here.</p>

      {loading && <ListSkeleton rows={3} />}
      {!loading && list.length === 0 && <div className="card p-8 text-center text-white/50">No withdrawal requests yet.</div>}

      <div className="space-y-3">
        {!loading && list.map((w) => (
          <div key={w.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold">{w.user_name} <span className="text-white/40 text-xs">· {w.user_phone}</span></p>
              <p className="text-sm text-white/60 font-mono">रू {w.amount} · {w.method}</p>
              <p className="text-xs text-white/40">{w.note}</p>
              <p className="text-xs text-white/30">{new Date(w.created_at).toLocaleString('en-IN')}</p>
            </div>
            {w.status === 'pending' ? (
              <div className="flex gap-2">
                <button onClick={() => complete(w.id)} className="btn-primary !py-2 !px-3 text-sm">Mark sent</button>
                <button onClick={() => reject(w.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger">Reject &amp; refund</button>
              </div>
            ) : (
              <span className={`pill ${w.status === 'completed' ? 'pill-approved' : 'pill-rejected'}`}>{w.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
