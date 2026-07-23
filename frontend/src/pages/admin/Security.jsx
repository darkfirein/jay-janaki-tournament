import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Security() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/login-attempts').then((res) => setData(res.data));
  }, []);

  if (!data) return <ListSkeleton rows={5} />;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Security</h1>
      <p className="text-white/50 mb-6">Login activity — watch for repeated failures, which usually means someone's guessing passwords.</p>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-1">Suspicious activity</h2>
        <p className="text-white/40 text-sm mb-4">3+ failed logins from the same Game UID or IP in the last 24 hours.</p>
        {data.suspicious.length === 0 ? (
          <p className="text-signal text-sm">Nothing flagged right now.</p>
        ) : (
          <div className="space-y-2">
            {data.suspicious.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0">
                <div>
                  <p className="font-mono">{s.game_uid || '(no UID given)'}</p>
                  <p className="text-white/40 text-xs">IP: {s.ip || 'unknown'}</p>
                </div>
                <div className="text-right">
                  <p className="text-danger font-semibold">{s.fail_count} failed attempts</p>
                  <p className="text-white/30 text-xs">{timeAgo(s.last_attempt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold mb-4">Recent login attempts</h2>
        <div className="space-y-2">
          {data.recent.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0">
              <span className="font-mono">{a.game_uid || '(no UID given)'}</span>
              <span className="text-white/40 text-xs">{a.ip || 'unknown'}</span>
              <span className={a.success ? 'text-signal' : 'text-danger'}>{a.success ? 'Success' : 'Failed'}</span>
              <span className="text-white/30 text-xs">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
