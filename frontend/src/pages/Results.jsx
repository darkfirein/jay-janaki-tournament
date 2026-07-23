import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { ListSkeleton } from '../components/SkeletonLoader.jsx';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments/results/all').then((res) => setResults(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Hall of Fame</p>
      <h1 className="font-display text-4xl font-bold mb-1">Match Results</h1>
      <p className="text-white/50 mb-8">Winners and prize payouts from completed tournaments.</p>

      {loading && <ListSkeleton rows={4} />}
      {!loading && results.length === 0 && (
        <div className="card p-8 text-center text-white/50">No results published yet. Check back after the next match!</div>
      )}

      <div className="space-y-4">
        {results.map((t) => (
          <div key={t.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-volt font-semibold uppercase tracking-wide">{t.game_name}</p>
                <h3 className="font-display text-xl font-bold">{t.title}</h3>
              </div>
              <span className="text-xs text-white/40">{formatDate(t.match_time)}</span>
            </div>

            {t.winners.length > 0 ? (
              <div className="space-y-2 mb-3">
                {t.winners.map((w, i) => (
                  <div key={i} className="flex items-center justify-between bg-volt/10 border border-volt/25 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-volt font-bold text-sm">{w.player_rank || `#${i + 1}`}</span>
                      <span className="font-semibold">{w.winner_name}</span>
                    </div>
                    <span className="font-mono text-volt font-bold">रू {w.winning_amount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40 mb-3">Winners will be announced here soon.</p>
            )}

            {t.result_note && <p className="text-sm text-white/60 border-t border-line pt-3">{t.result_note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
