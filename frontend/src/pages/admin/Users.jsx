import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { downloadCsv } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/users').then((res) => {
      setUsers(res.data.users);
      setTotals(res.data.totals);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.game_uid || '').toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-3xl font-bold">Users</h1>
        <button onClick={() => downloadCsv('/admin/export/users.csv', 'users.csv')} className="btn-secondary !py-2 !px-3 text-sm shrink-0">
          Export CSV
        </button>
      </div>
      <p className="text-white/50 mb-6">Everyone registered on the platform. Tap a row for full wallet &amp; booking details.</p>

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="font-mono text-lg sm:text-2xl font-bold">{totals.total_users}</p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase mt-1">Total Users</p>
          </div>
          <div className="card p-4 text-center">
            <p className="font-mono text-lg sm:text-2xl font-bold text-signal flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
              {totals.online_count}
            </p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase mt-1">Online Now</p>
          </div>
          <div className="card p-4 text-center">
            <p className="font-mono text-lg sm:text-2xl font-bold text-volt">रू {totals.total_wallet_balance}</p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase mt-1">Total Wallet Balance</p>
          </div>
          <div className="card p-4 text-center">
            <p className="font-mono text-lg sm:text-2xl font-bold text-signal">रू {totals.total_topup}</p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase mt-1">Total Top-up</p>
          </div>
          <div className="card p-4 text-center">
            <p className="font-mono text-lg sm:text-2xl font-bold text-flame">रू {totals.total_winnings}</p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase mt-1">Total Winnings Paid</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
        <input
          className="input !pl-11"
          placeholder="Search by Game UID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-white/40 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Game UID</th>
              <th className="text-left px-4 py-3">Wallet</th>
              <th className="text-left px-4 py-3">Top-up</th>
              <th className="text-left px-4 py-3">Winnings</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                className="border-t border-line hover:bg-panel/60 cursor-pointer transition"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.is_online ? 'bg-signal animate-pulse' : 'bg-white/15'}`} title={u.is_online ? 'Online' : 'Offline'} />
                    {u.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/60 font-mono whitespace-nowrap">{u.game_uid}</td>
                <td className="px-4 py-3 font-mono text-volt whitespace-nowrap">रू {u.wallet_balance ?? 0}</td>
                <td className="px-4 py-3 font-mono text-signal whitespace-nowrap">रू {u.total_topup ?? 0}</td>
                <td className="px-4 py-3 font-mono text-flame whitespace-nowrap">रू {u.total_winnings ?? 0}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`pill ${u.role === 'admin' ? 'pill-approved' : 'pill-pending'}`}>{u.role}</span>
                  {u.is_blocked && <span className="pill pill-rejected ml-1">Blocked</span>}
                </td>
                <td className="px-4 py-3 text-white/40 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="text-center text-white/40 py-8">No user found with that Game UID.</p>
        )}
      </div>
      )}
    </div>
  );
}
