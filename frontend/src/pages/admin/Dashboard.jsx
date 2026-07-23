import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api.js';
import { StatsSkeleton } from '../../components/SkeletonLoader.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <StatsSkeleton />;

  const cards = [
    { label: 'Total users', value: stats.totalUsers },
    { label: 'Online now', value: stats.onlineUsers, highlight: stats.onlineUsers > 0, dot: true },
    { label: 'Tournaments', value: stats.totalTournaments },
    { label: 'Pending approvals', value: stats.pendingBookings, highlight: stats.pendingBookings > 0 },
    { label: 'Approved bookings', value: stats.approvedBookings },
    { label: 'Revenue (approved)', value: `रू ${stats.revenue}` }
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Dashboard</h1>
      <p className="text-white/50 mb-6">Overview of your tournament platform.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={`card p-5 ${c.highlight ? 'border-warn/50' : ''}`}>
            <p className="text-xs text-white/40 uppercase mb-1 flex items-center gap-1.5">
              {c.dot && <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />}
              {c.label}
            </p>
            <p className={`font-mono text-2xl font-bold ${c.highlight ? 'text-warn' : ''}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {stats.pendingBookings > 0 && (
        <div className="card p-5 border-warn/40 flex items-center justify-between">
          <p className="text-sm text-white/70">
            You have <span className="text-warn font-semibold">{stats.pendingBookings}</span> payment{stats.pendingBookings > 1 ? 's' : ''} waiting for verification.
          </p>
          <Link to="/admin/bookings" className="btn-primary !py-2 !px-4 text-sm">Review now</Link>
        </div>
      )}
    </div>
  );
}
