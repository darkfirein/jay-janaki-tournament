import React, { useEffect, useState } from 'react';
import api, { fileUrl } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

export default function Deposits() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/deposits').then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function approve(id) {
    if (!confirm('Approve this deposit? The amount will be added to the user\'s wallet.')) return;
    await api.put(`/admin/deposits/${id}/approve`);
    load();
  }

  async function reject(id) {
    if (!confirm('Reject this deposit request?')) return;
    await api.put(`/admin/deposits/${id}/reject`);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Deposit Requests</h1>
      <p className="text-white/50 mb-6">"Scan &amp; Pay" wallet top-ups — verify the screenshot and UTR, then approve or reject.</p>

      {loading && <ListSkeleton rows={3} />}
      {!loading && list.length === 0 && <div className="card p-8 text-center text-white/50">No deposit requests yet.</div>}

      <div className="space-y-3">
        {!loading && list.map((d) => (
          <div key={d.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {d.screenshot_path && (
                <a href={fileUrl(d.screenshot_path)} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={fileUrl(d.screenshot_path)} alt="Payment proof" className="w-16 h-16 rounded-lg object-cover border border-line" />
                </a>
              )}
              <div>
                <p className="font-semibold">{d.user_name} <span className="text-white/40 text-xs">· {d.game_uid} · {d.user_phone}</span></p>
                <p className="text-sm text-white/60 font-mono">रू {d.amount} · UTR: {d.reference}</p>
                <p className="text-xs text-white/30">{new Date(d.created_at).toLocaleString('en-IN')}</p>
              </div>
            </div>
            {d.status === 'pending' ? (
              <div className="flex gap-2">
                <button onClick={() => approve(d.id)} className="btn-primary !py-2 !px-3 text-sm">Approve</button>
                <button onClick={() => reject(d.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger">Reject</button>
              </div>
            ) : (
              <span className={`pill ${d.status === 'completed' ? 'pill-approved' : 'pill-rejected'}`}>{d.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
