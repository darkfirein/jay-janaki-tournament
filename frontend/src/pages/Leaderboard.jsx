import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { ListSkeleton } from '../components/SkeletonLoader.jsx';

const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments/leaderboard/all').then((res) => setRows(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Leaderboard</h1>
      <p className="text-white/50 mb-6">Top players ranked by total tournament winnings.</p>

      {loading && <ListSkeleton rows={6} />}
      {!loading && rows.length === 0 && (
        <div className="card p-8 text-center text-white/50">No winners yet — be the first!</div>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className={`card p-4 flex items-center gap-4 ${i < 3 ? 'border-volt/40' : ''}`}>
            <div className="w-9 text-center shrink-0">
              {i < 3 ? <span className="text-2xl">{medals[i]}</span> : <span className="font-mono text-white/40">#{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.in_game_name || r.name}</p>
              <p className="text-xs text-white/40">{r.tournaments_played} played · {r.wins} wins</p>
            </div>
            <p className="font-mono font-bold text-volt shrink-0">रू {r.total_winnings}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
