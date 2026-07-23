import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api.js';

export default function Results() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [resultNote, setResultNote] = useState('');
  const [status, setStatus] = useState('completed');
  const [savedMsg, setSavedMsg] = useState('');
  const [winnerOpenId, setWinnerOpenId] = useState(null);
  const [winnerForm, setWinnerForm] = useState({ player_rank: '', winning_amount: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/tournaments').then((res) => setTournaments(res.data));
  }, []);

  function loadTournamentData(id) {
    const t = tournaments.find((x) => String(x.id) === String(id));
    setTournament(t || null);
    setResultNote(t?.result_note || '');
    setStatus(t?.status || 'completed');
    if (id) {
      api.get(`/admin/bookings?tournament_id=${id}&status=approved`).then((res) => setPlayers(res.data));
    } else {
      setPlayers([]);
    }
  }

  function selectTournament(id) {
    setSelectedId(id);
    loadTournamentData(id);
  }

  async function saveResultSummary() {
    if (!tournament) return;
    try {
      await api.put(`/admin/tournaments/${tournament.id}`, { ...tournament, status, result_note: resultNote });
      setSavedMsg('Saved.');
      setTimeout(() => setSavedMsg(''), 2500);
      const refreshed = await api.get('/admin/tournaments');
      setTournaments(refreshed.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save.');
    }
  }

  function openWinner(p) {
    setWinnerOpenId(p.id);
    setWinnerForm({ player_rank: p.player_rank || '', winning_amount: p.winning_amount || '' });
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
      loadTournamentData(selectedId);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark as winner.');
    }
  }

  async function unmarkWinner(id) {
    await api.put(`/admin/bookings/${id}/winner`, { is_winner: false, winning_amount: 0, player_rank: '' });
    loadTournamentData(selectedId);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Results</h1>
      <p className="text-white/50 mb-6">Mark a tournament complete, write the summary, and declare winners.</p>

      <div className="card p-5 mb-6">
        <label className="field-label">Select tournament</label>
        <select className="input" value={selectedId} onChange={(e) => selectTournament(e.target.value)}>
          <option value="">Choose a tournament…</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.title} — {t.game_name} ({t.status})</option>
          ))}
        </select>
      </div>

      {tournament && (
        <>
          <div className="card p-5 mb-6 space-y-4">
            {savedMsg && <p className="text-signal text-sm">{savedMsg}</p>}
            {error && <p className="text-danger text-sm">{error}</p>}
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="field-label">Result summary (shown publicly)</label>
              <textarea className="input" rows={3} value={resultNote} onChange={(e) => setResultNote(e.target.value)} placeholder="e.g. Great final circle fight, thanks to everyone who joined!" />
            </div>
            <button onClick={saveResultSummary} className="btn-primary">Save</button>
          </div>

          <div className="card p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-lg font-bold mb-1">🔍 Room &amp; Kill Check</h2>
              <p className="text-sm text-white/50">Screenshot se room check aur kill-count payout — ab bookings page pe hai.</p>
            </div>
            <Link to={`/admin/tournaments/${tournament.id}`} className="btn-primary !py-2 !px-4 text-sm shrink-0">
              Open Check Result →
            </Link>
          </div>

          <h2 className="font-display text-xl font-bold mb-3">Approved players ({players.length})</h2>
          {players.length === 0 && (
            <div className="card p-6 text-center text-white/50">No approved players yet for this tournament.</div>
          )}
          <div className="space-y-3">
            {players.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{p.user_name}</p>
                    <p className="text-xs text-white/40">{p.game_uid}{p.in_game_name && ` · ${p.in_game_name}`}</p>
                    {p.is_winner === 1 && (
                      <p className="text-sm text-volt font-semibold mt-1">🏆 {p.player_rank || 'Winner'} · रू {p.winning_amount}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {p.is_winner === 1 ? (
                      <button onClick={() => unmarkWinner(p.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger">Remove</button>
                    ) : (
                      <button onClick={() => openWinner(p)} className="btn-primary !py-2 !px-3 text-sm">Mark winner</button>
                    )}
                  </div>
                </div>

                {winnerOpenId === p.id && (
                  <div className="mt-3 pt-3 border-t border-line space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="input" placeholder="Rank (e.g. 1st place)" value={winnerForm.player_rank} onChange={(e) => setWinnerForm({ ...winnerForm, player_rank: e.target.value })} />
                      <input className="input" type="number" min="0" placeholder="Winning amount (रू)" value={winnerForm.winning_amount} onChange={(e) => setWinnerForm({ ...winnerForm, winning_amount: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => markWinner(p.id)} className="btn-primary !py-2 !px-4 text-sm">Confirm</button>
                      <button onClick={() => setWinnerOpenId(null)} className="btn-secondary !py-2 !px-4 text-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
