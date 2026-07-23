import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { fileUrl } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

const statusOrder = ['pending', 'approved', 'rejected'];
const statusLabel = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

export default function TournamentBookings() {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [winnerOpenId, setWinnerOpenId] = useState(null);
  const [winnerForm, setWinnerForm] = useState({ player_rank: '', winning_amount: '' });
  const [roomForm, setRoomForm] = useState({ room_id: '', room_password: '' });
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomCheckFile, setRoomCheckFile] = useState(null);
  const [roomCheckScanning, setRoomCheckScanning] = useState(false);
  const [roomCheckError, setRoomCheckError] = useState('');
  const [roomCheckResults, setRoomCheckResults] = useState(null);

  const [ratePerKill, setRatePerKill] = useState('');
  const [killScreenshot, setKillScreenshot] = useState(null);
  const [killScanning, setKillScanning] = useState(false);
  const [killScanResults, setKillScanResults] = useState(null);
  const [killConfirming, setKillConfirming] = useState(false);
  const [killError, setKillError] = useState('');
  const [killPayoutMsg, setKillPayoutMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get(`/admin/tournaments/${id}`).then((res) => {
      setTournament(res.data);
      setRatePerKill(res.data.rate_per_kill > 0 ? String(res.data.rate_per_kill) : '');
    });
    api.get(`/admin/bookings?tournament_id=${id}`).then((res) => setBookings(res.data));
  }
  useEffect(load, [id]);

  async function approve(bookingId) {
    await api.put(`/admin/bookings/${bookingId}/approve`, {});
    load();
  }

  async function reject(bookingId) {
    const note = prompt('Reason for rejection (shown to the player):', 'Payment could not be verified.');
    if (note === null) return;
    await api.put(`/admin/bookings/${bookingId}/reject`, { admin_note: note });
    load();
  }

  function openWinner(b) {
    setWinnerOpenId(b.id);
    setWinnerForm({ player_rank: b.player_rank || '', winning_amount: b.winning_amount || '' });
    setError('');
  }

  async function markWinner(bookingId) {
    if (!winnerForm.winning_amount) return setError('Enter the winning amount.');
    try {
      await api.put(`/admin/bookings/${bookingId}/winner`, {
        is_winner: true,
        player_rank: winnerForm.player_rank,
        winning_amount: Number(winnerForm.winning_amount)
      });
      setWinnerOpenId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark as winner.');
    }
  }

  async function unmarkWinner(bookingId) {
    await api.put(`/admin/bookings/${bookingId}/winner`, { is_winner: false, winning_amount: 0, player_rank: '' });
    load();
  }

  async function releaseRoom() {
    if (!roomForm.room_id || !roomForm.room_password) return setError('Enter both room ID and password.');
    try {
      const { data } = await api.put(`/admin/tournaments/${id}/release-room`, roomForm);
      setMsg(`Sent to ${data.updated_count} player${data.updated_count === 1 ? '' : 's'}.`);
      setTimeout(() => setMsg(''), 3000);
      setShowRoomForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send room details.');
    }
  }

  async function scanRoomCheck() {
    if (!roomCheckFile) return setRoomCheckError('Upload a room/lobby screenshot first.');
    setRoomCheckError('');
    setRoomCheckScanning(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', roomCheckFile);
      const { data } = await api.post(`/admin/tournaments/${id}/room-check`, fd);
      setRoomCheckResults(data);
    } catch (err) {
      setRoomCheckError(err.response?.data?.error || 'Could not scan the screenshot.');
    } finally {
      setRoomCheckScanning(false);
    }
  }

  async function scanKillScreenshot() {
    if (!killScreenshot) return setKillError('Choose a results screenshot first.');
    if (!ratePerKill || Number(ratePerKill) <= 0) return setKillError('Enter the rate per kill (रू).');

    setKillError('');
    setKillScanning(true);
    setKillScanResults(null);
    try {
      const fd = new FormData();
      fd.append('screenshot', killScreenshot);
      fd.append('rate_per_kill', ratePerKill);
      const res = await api.post(`/admin/tournaments/${id}/results/scan`, fd);
      setKillScanResults(res.data);
    } catch (err) {
      setKillError(err.response?.data?.error || 'Could not read the screenshot.');
    } finally {
      setKillScanning(false);
    }
  }

  function updateKillScanRow(bookingId, value) {
    setKillScanResults((prev) => ({
      ...prev,
      results: prev.results.map((r) => {
        if (r.booking_id !== bookingId) return r;
        const kills = Number(value) || 0;
        return { ...r, kills, amount: kills * prev.rate_per_kill };
      })
    }));
  }

  async function confirmKillPayout() {
    if (!killScanResults) return;
    setKillConfirming(true);
    setKillError('');
    setKillPayoutMsg('');
    try {
      const res = await api.post(`/admin/tournaments/${id}/results/confirm`, {
        rate_per_kill: killScanResults.rate_per_kill,
        results: killScanResults.results.filter((r) => !r.already_paid).map((r) => ({
          booking_id: r.booking_id, kills: r.kills, amount: r.amount
        }))
      });
      setKillPayoutMsg(`Paid ${res.data.paid_count} player(s)${res.data.skipped_count ? `, skipped ${res.data.skipped_count} (already paid or 0 kills)` : ''}.`);
      setKillScanResults(null);
      setKillScreenshot(null);
      load();
    } catch (err) {
      setKillError(err.response?.data?.error || 'Could not process payout.');
    } finally {
      setKillConfirming(false);
    }
  }

  if (!tournament) return <ListSkeleton rows={4} />;

  const grouped = statusOrder.map((s) => ({ status: s, items: bookings.filter((b) => b.status === s) }));

  return (
    <div>
      <Link to="/admin/tournaments" className="text-sm text-white/50 hover:text-volt">&larr; Back to tournaments</Link>
      <p className="text-xs text-volt uppercase font-semibold mt-3">{tournament.game_name}</p>
      <h1 className="font-display text-3xl font-bold mb-1">{tournament.title}</h1>
      <p className="text-white/50 mb-6">रू {tournament.entry_fee} · {tournament.filled_slots}/{tournament.total_slots} slots · {bookings.length} total payments</p>

      {msg && <div className="card p-3 mb-4 text-signal text-sm text-center">{msg}</div>}
      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {tournament.approved_count > 0 && (
        <div className="card p-5 mb-6">
          {showRoomForm ? (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input" placeholder="Room ID" value={roomForm.room_id} onChange={(e) => setRoomForm({ ...roomForm, room_id: e.target.value })} />
                <input className="input" placeholder="Room password" value={roomForm.room_password} onChange={(e) => setRoomForm({ ...roomForm, room_password: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={releaseRoom} className="btn-primary !py-2 !px-4 text-sm">Send to all {tournament.approved_count} players</button>
                <button onClick={() => setShowRoomForm(false)} className="btn-secondary !py-2 !px-4 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowRoomForm(true)} className="btn-primary">
              🔑 {tournament.waiting_count > 0 ? `Send room to ${tournament.waiting_count} waiting player(s)` : 'Resend / update room details'}
            </button>
          )}
        </div>
      )}

      {tournament.approved_count > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold mb-1">🔍 Check Result</h2>
          <p className="text-white/50 text-sm mb-4">Screenshot se do cheezein check kar sakte ho — match se pehle kaun room me hai, aur match ke baad kills se payout.</p>

          <div className="card p-5 mb-4">
            <h3 className="font-display text-lg font-bold mb-1">Before match — Room Check</h3>
            <p className="text-white/50 text-sm mb-4">
              In-game room/lobby ka screenshot upload karo — approved players ke in-game nickname se match karke dikhayega kaun room me hai, kaun missing hai.
            </p>

            {roomCheckError && <p className="text-danger text-sm mb-3">{roomCheckError}</p>}

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="file" accept="image/*"
                onChange={(e) => { setRoomCheckFile(e.target.files?.[0] || null); setRoomCheckResults(null); }}
                className="input file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-volt file:text-white file:text-sm"
              />
              <button onClick={scanRoomCheck} disabled={roomCheckScanning} className="btn-primary !px-4 shrink-0">
                {roomCheckScanning ? 'Scanning…' : 'Scan screenshot'}
              </button>
            </div>

            {roomCheckResults && (() => {
              const missing = roomCheckResults.results.filter((r) => !r.matched);
              const present = roomCheckResults.results.filter((r) => r.matched);
              return (
                <div className="space-y-4 pt-3 border-t border-line">
                  <p className="text-sm font-semibold">
                    <span className={missing.length === 0 ? 'text-signal' : 'text-warn'}>
                      {roomCheckResults.matched_count}/{roomCheckResults.total} players found in the screenshot
                    </span>
                  </p>

                  {missing.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-warn uppercase tracking-wide">⚠️ Not found in screenshot ({missing.length})</p>
                      {missing.map((r) => (
                        <div key={r.booking_id} className="p-3 rounded-xl border border-warn/40 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{r.user_name}</p>
                            <p className="text-xs text-white/40">{r.in_game_name || 'no in-game nickname set'} · {r.game_uid}</p>
                          </div>
                          <Link to={`/admin/users/${r.user_id}`} className="text-xs text-volt hover:underline shrink-0">View user →</Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {present.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-signal uppercase tracking-wide">✅ Found ({present.length})</p>
                      {present.map((r) => (
                        <div key={r.booking_id} className="p-3 rounded-xl border border-signal/30 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{r.user_name}</p>
                            <p className="text-xs text-white/40">{r.in_game_name} · matched: "{r.matched_text}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="card p-5">
            <h3 className="font-display text-lg font-bold mb-1">After match — Kill Count &amp; Payout 🎯</h3>
            <p className="text-white/50 text-sm mb-4">
              Match result ka screenshot upload karo — kills automatically padhe jayenge, players se match honge, aur amount preview me dikhega.
              Confirm karne se pehle edit kar sakte ho — wallet me tabhi paisa jayega jab confirm karoge.
            </p>

            {killError && <p className="text-danger text-sm mb-3">{killError}</p>}
            {killPayoutMsg && <p className="text-signal text-sm mb-3">{killPayoutMsg}</p>}

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="field-label">Rate per kill (रू)</label>
                <input type="number" min="0" className="input" value={ratePerKill} onChange={(e) => setRatePerKill(e.target.value)} placeholder="e.g. 10" />
              </div>
              <div>
                <label className="field-label">Result screenshot</label>
                <input type="file" accept="image/*" className="input" onChange={(e) => setKillScreenshot(e.target.files?.[0] || null)} />
              </div>
            </div>
            <button onClick={scanKillScreenshot} disabled={killScanning} className="btn-secondary mb-4">
              {killScanning ? 'Reading screenshot…' : 'Scan screenshot'}
            </button>

            {killScanResults && (() => {
              const needsReview = killScanResults.results.filter((r) => !r.already_paid && !r.matched);
              const rest = killScanResults.results.filter((r) => r.already_paid || r.matched);

              const row = (r) => (
                <div key={r.booking_id} className={`p-3 rounded-xl border ${r.already_paid ? 'border-line opacity-50' : r.matched ? 'border-signal/30' : 'border-warn/40'}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{r.user_name}</p>
                      <p className="text-xs text-white/40">
                        {r.in_game_name || 'no in-game nickname set'}
                        {r.already_paid && ' · already paid'}
                        {!r.already_paid && (r.matched ? ` · matched: "${r.matched_text}"` : ' · not found in screenshot')}
                      </p>
                    </div>
                    {!r.already_paid && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="0" className="input !w-20 !py-1.5"
                          value={r.kills}
                          onChange={(e) => updateKillScanRow(r.booking_id, e.target.value)}
                        />
                        <span className="text-xs text-white/40">kills</span>
                        <span className="text-sm font-semibold text-volt">रू {r.amount}</span>
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <div className="pt-3 border-t border-line space-y-4">
                  <p className="text-xs text-white/40">
                    Rate: रू {killScanResults.rate_per_kill}/kill. Unmatched ya galat kills ho toh neeche edit kar do, phir confirm karo.
                  </p>

                  {needsReview.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-warn uppercase tracking-wide flex items-center gap-1.5">
                        ⚠️ Needs review — screenshot me nahi mile ({needsReview.length})
                      </p>
                      {needsReview.map(row)}
                    </div>
                  )}

                  {rest.length > 0 && (
                    <div className="space-y-2">
                      {needsReview.length > 0 && (
                        <p className="text-xs font-bold text-signal uppercase tracking-wide">✅ Matched</p>
                      )}
                      {rest.map(row)}
                    </div>
                  )}

                  <button onClick={confirmKillPayout} disabled={killConfirming} className="btn-primary">
                    {killConfirming ? 'Paying out…' : 'Confirm & pay wallets'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {grouped.map(({ status, items }) => (
        items.length > 0 && (
          <div key={status} className="mb-8">
            <h2 className="font-display text-lg font-bold mb-3">{statusLabel[status]} ({items.length})</h2>
            <div className="space-y-3">
              {items.map((b) => (
                <div key={b.id} className="card p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <Link to={`/admin/users/${b.user_id}`} className="font-semibold hover:text-volt transition">{b.user_name}</Link>
                      <p className="text-xs text-white/40">{b.game_uid} {b.in_game_name && `· ${b.in_game_name}`} · {b.user_phone}</p>
                      <p className="text-sm text-white/50 mt-1">UTR: <span className="font-mono text-white/80">{b.utr_number}</span></p>
                      {b.status === 'approved' && b.room_id && (
                        <p className="text-sm text-signal mt-1 font-mono">Room sent: {b.room_id} / {b.room_password}</p>
                      )}
                      {b.status === 'approved' && !b.room_id && (
                        <p className="text-sm text-warn mt-1">Waiting for room details</p>
                      )}
                      {b.is_winner === 1 && (
                        <p className="text-sm text-volt font-semibold mt-1">🏆 {b.player_rank || 'Winner'} · रू {b.winning_amount}</p>
                      )}
                      {b.status === 'rejected' && <p className="text-sm text-danger mt-1">{b.admin_note}</p>}
                      {b.payout_method && (
                        <p className="text-xs text-white/40 mt-1">
                          Payout: {b.payout_method === 'wallet' ? '📱' : '🏦'} {b.payout_provider} · {b.payout_account_name} · {b.payout_account_number}
                        </p>
                      )}
                    </div>
                    {b.screenshot_path && (
                      <a href={fileUrl(b.screenshot_path)} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={fileUrl(b.screenshot_path)} alt="Payment screenshot" className="w-20 h-20 object-cover rounded-xl border border-line hover:border-volt/50 transition" />
                      </a>
                    )}
                  </div>

                  {status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-line flex gap-2">
                      <button onClick={() => approve(b.id)} className="btn-primary !py-2 !px-4 text-sm">Approve</button>
                      <button onClick={() => reject(b.id)} className="btn-secondary !py-2 !px-4 text-sm hover:!border-danger/60 hover:!text-danger">Reject</button>
                    </div>
                  )}

                  {status === 'approved' && (
                    <div className="mt-3 pt-3 border-t border-line">
                      {winnerOpenId === b.id ? (
                        <div className="space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input className="input" placeholder="Rank (e.g. 1st place)" value={winnerForm.player_rank} onChange={(e) => setWinnerForm({ ...winnerForm, player_rank: e.target.value })} />
                            <input className="input" type="number" min="0" placeholder="Winning amount (रू)" value={winnerForm.winning_amount} onChange={(e) => setWinnerForm({ ...winnerForm, winning_amount: e.target.value })} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => markWinner(b.id)} className="btn-primary !py-2 !px-4 text-sm">Confirm</button>
                            <button onClick={() => setWinnerOpenId(null)} className="btn-secondary !py-2 !px-4 text-sm">Cancel</button>
                          </div>
                        </div>
                      ) : b.is_winner === 1 ? (
                        <button onClick={() => unmarkWinner(b.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger">Remove winner</button>
                      ) : (
                        <button onClick={() => openWinner(b)} className="btn-primary !py-2 !px-3 text-sm">🏆 Mark as winner</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {bookings.length === 0 && (
        <div className="card p-8 text-center text-white/50">No one has paid for this tournament yet.</div>
      )}
    </div>
  );
}
