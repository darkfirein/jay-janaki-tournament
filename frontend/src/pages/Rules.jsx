import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { ListSkeleton } from '../components/SkeletonLoader.jsx';

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings').then((res) => {
      const lines = (res.data.rules_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      setRules(lines);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Fair Play</p>
      <h1 className="font-display text-4xl font-bold mb-1">Tournament Rules</h1>
      <p className="text-white/50 mb-8">Read these before you join a room.</p>

      {loading && <ListSkeleton rows={5} />}

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <div key={i} className="card p-4 flex items-start gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-volt/15 border border-volt/40 text-volt font-bold text-xs flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-white/80 leading-relaxed">{rule.replace(/^\d+[.)]\s*/, '')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
