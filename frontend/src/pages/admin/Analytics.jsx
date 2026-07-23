import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api.js';
import { StatsSkeleton } from '../../components/SkeletonLoader.jsx';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    api.get('/admin/analytics').then((res) => setData(res.data));
    api.get('/admin/reviews').then((res) => setReviews(res.data));
  }, []);

  if (!data) return <StatsSkeleton />;

  const totalRevenue30d = data.revenueByDay.reduce((sum, d) => sum + Number(d.revenue), 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Analytics</h1>
      <p className="text-white/50 mb-6">How the platform's been doing lately.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-xs text-white/40 uppercase mb-1">Revenue (last 30 days)</p>
          <p className="font-mono text-2xl font-bold text-volt">रू {totalRevenue30d}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-white/40 uppercase mb-1">One-time players</p>
          <p className="font-mono text-2xl font-bold">{data.repeatVsNew.one_time_players}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-white/40 uppercase mb-1">Repeat players</p>
          <p className="font-mono text-2xl font-bold text-signal">{data.repeatVsNew.repeat_players}</p>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-4">Revenue over time</h2>
        {data.revenueByDay.length === 0 ? (
          <p className="text-white/40 text-sm">No approved bookings in the last 30 days yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
              <XAxis dataKey="day" stroke="#ffffff60" fontSize={11} />
              <YAxis stroke="#ffffff60" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0B0A12', border: '1px solid #ffffff20', borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="#A855F7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-4">Bookings by game</h2>
        {data.gamePopularity.length === 0 ? (
          <p className="text-white/40 text-sm">No approved bookings yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.gamePopularity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
              <XAxis dataKey="game_name" stroke="#ffffff60" fontSize={11} />
              <YAxis stroke="#ffffff60" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0B0A12', border: '1px solid #ffffff20', borderRadius: 8 }} />
              <Bar dataKey="bookings" fill="#22D3EE" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold mb-4">Player reviews</h2>
        {!reviews || reviews.averages.length === 0 ? (
          <p className="text-white/40 text-sm">No reviews submitted yet.</p>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {reviews.averages.map((a) => (
                <div key={a.tournament_id} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0">
                  <span className="truncate pr-3">{a.title}</span>
                  <span className="font-mono text-volt shrink-0">★ {a.avg_rating} ({a.review_count})</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Recent comments</p>
            <div className="space-y-3">
              {reviews.reviews.filter((r) => r.comment).slice(0, 10).map((r) => (
                <div key={r.id} className="text-sm">
                  <p className="text-white/80">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} — <span className="text-white/50">{r.tournament_title}</span></p>
                  <p className="text-white/60">{r.comment}</p>
                  <p className="text-[11px] text-white/30">{r.user_name}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
