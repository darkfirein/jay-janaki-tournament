import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fileUrl } from '../api.js';
import useCountdown from '../hooks/useCountdown.js';
import SkeletonLoader from '../components/SkeletonLoader.jsx';

function formatTime(iso) {
  if (!iso) return 'Time to be announced';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusTimeLabel(t) {
  if (t.status === 'live') return 'Live Now';
  if (t.status === 'completed') {
    if (!t.match_time) return 'Completed';
    const days = Math.floor((Date.now() - new Date(t.match_time).getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
  if (t.status === 'cancelled') return 'Cancelled';
  return formatTime(t.match_time);
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live Now' },
  { key: 'filling', label: 'Filling' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' }
];

const HERO_DEFAULTS = {
  hero_badge: "Nepal's Prestige Gaming Hub",
  hero_quote: 'Game timi khela, paise hami dinchham!',
  hero_heading_line1: "Nepal's Ultimate",
  hero_heading_line2: 'Battleground:',
  hero_heading_highlight: 'Claim Your Glory!',
  hero_paragraph: "Stop grinding for free. Drop into Nepal's fiercest real-money gaming arena, wipe out the lobby with your squad, and cash out instantly via eSewa & Khalti. Your phone, your squad, your victory. Slots are filling fast!",
  hero_stat1_value: 'Rs. 10L+',
  hero_stat1_label: 'Monthly Prizes',
  hero_stat2_value: 'Instant',
  hero_stat2_label: 'eSewa & Khalti',
  hero_stat3_value: '100%',
  hero_stat3_label: 'Anti-Cheat Safe',
  hero_cta_text: 'Start Winning Now'
};

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ game: 'all', statusTab: 'all', search: '' });
  const [specsModal, setSpecsModal] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api.get('/tournaments').then((res) => setTournaments(res.data)).finally(() => setLoading(false));
    api.get('/announcements').then((res) => setAnnouncements(res.data));
    api.get('/settings').then((res) => setSettings(res.data));
  }, []);

  const hero = (key) => settings[key] || HERO_DEFAULTS[key];

  const gameOptions = useMemo(() => {
    return [...new Set(tournaments.map((t) => t.game_name).filter(Boolean))].sort();
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (filters.game !== 'all' && t.game_name !== filters.game) return false;

      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const hay = `${t.title} ${t.game_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.statusTab !== 'all') {
        const slotsLeft = t.total_slots - t.filled_slots;
        const full = slotsLeft <= 0;
        const bookingNotOpen = t.booking_opens_at && new Date(t.booking_opens_at).getTime() > Date.now();

        if (filters.statusTab === 'live' && t.status !== 'live') return false;
        if (filters.statusTab === 'completed' && t.status !== 'completed') return false;
        if (filters.statusTab === 'filling' && !(t.status === 'upcoming' && !full && !bookingNotOpen)) return false;
        if (filters.statusTab === 'upcoming' && !(t.status === 'upcoming' && (full || bookingNotOpen))) return false;
      }

      return true;
    });
  }, [tournaments, filters]);

  const nextTournament = useMemo(() => {
    return tournaments
      .filter((t) => t.match_time && (t.status === 'upcoming' || t.status === 'live'))
      .sort((a, b) => new Date(a.match_time) - new Date(b.match_time))[0];
  }, [tournaments]);

  const countdown = useCountdown(nextTournament?.match_time);

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden py-10 sm:py-14">
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-flame/10 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-5xl mx-auto px-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-flame/40 bg-flame/10 text-xs font-mono font-bold tracking-widest text-flame uppercase mb-5">
            ✨ {hero('hero_badge')}
          </span>

          <p className="text-flame italic font-semibold text-sm sm:text-base mb-3">
            "{hero('hero_quote')}"
          </p>

          <h1 className="font-display font-black italic text-3xl sm:text-5xl uppercase tracking-tight mb-4 leading-tight">
            <span className="block text-white">{hero('hero_heading_line1')}</span>
            <span className="block text-white">{hero('hero_heading_line2')}</span>
            <span className="block bg-gradient-to-r from-flame via-pink-500 to-volt bg-clip-text text-transparent">
              {hero('hero_heading_highlight')}
            </span>
          </h1>

          <p className="max-w-xl text-white/50 text-sm sm:text-base mb-6">
            {hero('hero_paragraph')}
          </p>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 max-w-xl">
            <div className="border border-line rounded-xl p-3 text-center">
              <p className="font-display font-black text-sm sm:text-lg text-flame">{hero('hero_stat1_value')}</p>
              <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide mt-0.5">{hero('hero_stat1_label')}</p>
            </div>
            <div className="border border-line rounded-xl p-3 text-center">
              <p className="font-display font-black text-sm sm:text-lg text-signal">{hero('hero_stat2_value')}</p>
              <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide mt-0.5">{hero('hero_stat2_label')}</p>
            </div>
            <div className="border border-line rounded-xl p-3 text-center">
              <p className="font-display font-black text-sm sm:text-lg text-volt">{hero('hero_stat3_value')}</p>
              <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide mt-0.5">{hero('hero_stat3_label')}</p>
            </div>
          </div>

          <a
            href="#tournaments"
            className="max-w-xl flex items-center justify-center gap-2 rounded-xl py-3.5 font-display font-bold uppercase tracking-wide text-white bg-gradient-to-r from-flame via-pink-500 to-volt hover:opacity-90 transition mb-8"
          >
            🔥 {hero('hero_cta_text')} <span>›</span>
          </a>

          {nextTournament && (
            <div className="max-w-md card p-5 mb-2 hover:border-flame/40 transition">
              <p className="text-xs text-flame font-mono font-bold tracking-widest uppercase mb-3">
                ⏱ Next up: {nextTournament.title}
              </p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'Days', val: countdown.days },
                  { label: 'Hrs', val: countdown.hours },
                  { label: 'Mins', val: countdown.minutes },
                  { label: 'Secs', val: countdown.seconds }
                ].map((u) => (
                  <div key={u.label} className="bg-ink/60 rounded-lg p-2 sm:p-3 border border-line">
                    <p className="font-display font-black text-xl sm:text-2xl text-flame">{String(u.val).padStart(2, '0')}</p>
                    <p className="text-[10px] text-white/40 font-mono tracking-widest uppercase mt-0.5">{u.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5">
        <div className="border-t border-line" />
      </div>

      {/* ---------- Two-column body: tournaments (left) + sidebar (right) ---------- */}
      <div id="tournaments" className="max-w-6xl mx-auto px-5 pb-14 scroll-mt-20 grid md:grid-cols-3 gap-8">
        <section className="md:col-span-2">
          {/* Game pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-6 pb-1">
            <button
              onClick={() => setFilters((f) => ({ ...f, game: 'all' }))}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition ${
                filters.game === 'all' ? 'bg-flame border-flame text-black' : 'border-line text-white/60 hover:border-flame/40'
              }`}
            >
              All Games
            </button>
            {gameOptions.map((g) => (
              <button
                key={g}
                onClick={() => setFilters((f) => ({ ...f, game: g }))}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition uppercase ${
                  filters.game === g ? 'bg-flame border-flame text-black' : 'border-line text-white/60 hover:border-flame/40'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex gap-5 overflow-x-auto no-scrollbar border-b border-line mt-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilters((f) => ({ ...f, statusTab: tab.key }))}
                className={`shrink-0 pb-3 pt-1 text-sm font-semibold transition border-b-2 -mb-px ${
                  filters.statusTab === tab.key ? 'text-flame border-flame' : 'text-white/40 border-transparent hover:text-white/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-4 mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by tournament name or game..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="input pl-10"
            />
          </div>

          {tournaments.length === 0 && (
            <div className="card p-8 text-center text-white/50">No tournaments live right now — check back soon.</div>
          )}
          {tournaments.length > 0 && filteredTournaments.length === 0 && (
            <div className="card p-8 text-center text-white/50">No tournaments match your filters.</div>
          )}

          <div className="space-y-5">
            {filteredTournaments.map((t) => {
              const slotsLeft = t.total_slots - t.filled_slots;
              const full = slotsLeft <= 0;
              const bookingNotOpen = t.booking_opens_at && new Date(t.booking_opens_at).getTime() > Date.now();
              const pct = t.total_slots > 0 ? Math.min(100, Math.round((t.filled_slots / t.total_slots) * 100)) : 0;
              const mapName = t.map_mode || '';
              const modeName = t.match_type || '';

              return (
                <div key={t.id} className="rounded-2xl border border-line bg-panel/80 backdrop-blur-sm overflow-hidden">
                  <div className="relative">
                    {t.banner_path ? (
                      <img src={fileUrl(t.banner_path)} alt={t.title} className="w-full h-44 object-cover" />
                    ) : (
                      <div className="w-full h-44 bg-gradient-to-br from-line to-ink flex items-center justify-center text-3xl">
                        🎮
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      {t.game_name}
                    </span>
                    {t.status === 'live' && (
                      <span className="absolute top-3 right-3 bg-danger text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE NOW
                      </span>
                    )}
                    {t.status === 'completed' && (
                      <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white/60 text-[11px] font-bold px-2.5 py-1 rounded-md">
                        COMPLETED
                      </span>
                    )}
                    {t.status === 'cancelled' && (
                      <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white/60 text-[11px] font-bold px-2.5 py-1 rounded-md">
                        CANCELLED
                      </span>
                    )}
                    {mapName && (
                      <span className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-[11px] font-medium px-2.5 py-1 rounded-md">
                        🗺️ {mapName}
                      </span>
                    )}
                    {modeName && (
                      <span className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-[11px] font-medium px-2.5 py-1 rounded-md">
                        {modeName}
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="font-display italic font-black text-xl uppercase mb-1 leading-tight">{t.title}</h3>
                    <p className="text-xs text-white/40 mb-4 flex items-center gap-1.5">
                      📅 {statusTimeLabel(t)}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="border border-line rounded-xl p-3">
                        <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Prize Pool</p>
                        <p className="text-flame font-display font-black text-lg">रू {t.prize_pool || '—'}</p>
                      </div>
                      <div className="border border-line rounded-xl p-3">
                        <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Entry Fee</p>
                        <p className="text-white font-display font-black text-lg">रू {t.entry_fee}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                      <span>👥 {t.filled_slots} / {t.total_slots} joined</span>
                      <span className={full ? 'text-danger font-semibold' : 'text-flame font-semibold'}>
                        {full ? 'Full' : `${slotsLeft} slots left`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-line overflow-hidden mb-5">
                      <div className="h-full bg-flame rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSpecsModal(t)}
                        className="flex-1 text-center border border-line rounded-xl py-2.5 text-sm font-semibold hover:border-flame/50 transition"
                      >
                        📄 Specs &amp; Rules
                      </button>

                      {t.status === 'live' ? (
                        <Link
                          to={`/tournaments/${t.id}`}
                          className="flex-1 text-center bg-danger/15 text-danger border border-danger/40 rounded-xl py-2.5 text-sm font-bold hover:bg-danger/25 transition"
                        >
                          In Combat
                        </Link>
                      ) : t.status === 'completed' ? (
                        <span className="flex-1 text-center bg-line/40 text-white/30 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed">
                          Match Closed
                        </span>
                      ) : t.status === 'cancelled' ? (
                        <span className="flex-1 text-center bg-line/40 text-white/30 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed">
                          Cancelled
                        </span>
                      ) : bookingNotOpen ? (
                        <span className="flex-1 text-center bg-line/40 text-white/30 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed">
                          Opens {formatTime(t.booking_opens_at)}
                        </span>
                      ) : full ? (
                        <span className="flex-1 text-center bg-line/40 text-white/30 rounded-xl py-2.5 text-sm font-bold cursor-not-allowed">
                          Full
                        </span>
                      ) : (
                        <Link
                          to={`/tournaments/${t.id}`}
                          className="flex-1 text-center bg-flame text-black rounded-xl py-2.5 text-sm font-bold hover:bg-flame/90 transition"
                        >
                          Register Now
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Sidebar ---------- */}
        <aside className="space-y-4 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            <Link to="/leaderboard" className="card p-4 text-center md:text-left md:flex md:items-center md:gap-3 hover:border-flame/50 transition">
              <p className="text-2xl md:mb-0 mb-1">📊</p>
              <p className="text-xs font-semibold text-white/70">Leaderboard</p>
            </Link>
            <Link to="/rules" className="card p-4 text-center md:text-left md:flex md:items-center md:gap-3 hover:border-flame/50 transition">
              <p className="text-2xl md:mb-0 mb-1">📜</p>
              <p className="text-xs font-semibold text-white/70">Rules</p>
            </Link>
            <Link to="/results" className="card p-4 text-center md:text-left md:flex md:items-center md:gap-3 hover:border-flame/50 transition">
              <p className="text-2xl md:mb-0 mb-1">🏆</p>
              <p className="text-xs font-semibold text-white/70">Results</p>
            </Link>
            <Link to="/contact" className="card p-4 text-center md:text-left md:flex md:items-center md:gap-3 hover:border-flame/50 transition">
              <p className="text-2xl md:mb-0 mb-1">💬</p>
              <p className="text-xs font-semibold text-white/70">Contact &amp; Support</p>
            </Link>
          </div>

          {announcements.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">Announcements</p>
              {announcements.map((a) => (
                <div key={a.id} className="card overflow-hidden">
                  {a.image_path && (
                    <img src={fileUrl(a.image_path)} alt={a.title} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-4">
                    <p className="font-semibold text-sm">{a.title}</p>
                    {a.body && <p className="text-xs text-white/50 mt-1 line-clamp-3">{a.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ---------- Tournament Specifications Modal ---------- */}
      {specsModal && (() => {
        const mapName = specsModal.map_mode || '';
        const modeName = specsModal.match_type || '';
        const rules = (specsModal.notes || '').split('\n').map((r) => r.trim()).filter(Boolean);
        return (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-5"
            onClick={() => setSpecsModal(null)}
          >
            <div
              className="bg-panel border border-line rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-line sticky top-0 bg-panel z-10">
                <h2 className="font-display italic font-black text-xl uppercase">Tournament Specifications</h2>
                <button
                  type="button"
                  onClick={() => setSpecsModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:border-flame/50 text-white/60 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-center gap-4 border border-line rounded-xl p-4">
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-flame/10 border border-flame/30 flex items-center justify-center text-2xl">
                    🏆
                  </div>
                  <div>
                    <p className="font-display italic font-black text-lg uppercase leading-tight">{specsModal.title}</p>
                    <p className="text-xs text-flame font-bold tracking-wide uppercase mt-0.5">{specsModal.game_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mb-1">Combat Map</p>
                    <p className="text-sm font-semibold text-white">{mapName || 'To be announced'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mb-1">Match Mode</p>
                    <p className="text-sm font-semibold text-white">{modeName || 'To be announced'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mb-1">Prize Pool</p>
                    <p className="text-sm font-bold text-flame">रू {specsModal.prize_pool || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mb-1">Entry Fee</p>
                    <p className="text-sm font-bold text-white">रू {specsModal.entry_fee}</p>
                  </div>
                </div>

                <div className="border-t border-line pt-5">
                  <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide mb-3">
                    🛡️ Rules of Engagement
                  </p>
                  {rules.length === 0 ? (
                    <div className="border border-line rounded-xl p-4 text-sm text-white/40">
                      No specific rules added for this tournament yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rules.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-3 border border-line rounded-xl p-3.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-flame mt-1.5 shrink-0" />
                          <p className="text-sm text-white/80">{rule}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to={`/tournaments/${specsModal.id}`}
                  onClick={() => setSpecsModal(null)}
                  className="block text-center bg-flame text-black rounded-xl py-3 text-sm font-bold hover:bg-flame/90 transition"
                >
                  View Full Details
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
