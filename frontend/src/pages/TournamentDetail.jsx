import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Trophy, Users, Clock, Coins, Shield, Wallet, CreditCard,
  MessageSquare, Send, CheckCircle2, Flame, Zap, AlertCircle
} from 'lucide-react';
import api, { fileUrl, socketUrl } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import useCountdown from '../hooks/useCountdown.js';
import { TournamentDetailSkeleton } from '../components/SkeletonLoader.jsx';

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [success, setSuccess] = useState(false);

  const [walletBalance, setWalletBalance] = useState(null);
  const [walletPaying, setWalletPaying] = useState(false);
  const [walletError, setWalletError] = useState('');

  const [estimatedKills, setEstimatedKills] = useState(5);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatDenied, setChatDenied] = useState('');
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    api.get(`/tournaments/${id}`).then((res) => setTournament(res.data));
    if (user) api.get('/wallet/me').then((res) => setWalletBalance(res.data.balance)).catch(() => {});
  }, [id, user]);

  useEffect(() => {
    const socket = io(socketUrl, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    socket.emit('join_tournament_room', id);
    socket.on('join_ok', () => setChatDenied(''));
    socket.on('join_denied', (data) => setChatDenied(data?.reason || 'You cannot join this chat.'));
    socket.on('receive_message', (data) => setChatHistory((prev) => [...prev, data]));
    socket.on('slot_update', () => {
      api.get(`/tournaments/${id}`).then((res) => setTournament(res.data));
    });
    return () => socket.disconnect();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  function handleSendMessage(e) {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (!chatMessage.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      tournamentId: id,
      sender: { id: user.id, name: user.name },
      text: chatMessage.trim()
    });
    setChatMessage('');
  }

  async function handleWalletPay() {
    if (!user) return navigate('/login');
    setWalletError('');
    setWalletPaying(true);
    try {
      await api.post('/bookings/wallet-pay', { tournament_id: id });
      setSuccess(true);
      socketRef.current?.emit('join_tournament_room', id);
    } catch (err) {
      setWalletError(err.response?.data?.error || 'Could not pay from wallet.');
    } finally {
      setWalletPaying(false);
    }
  }

  const bookingNotOpen = !!(tournament?.booking_opens_at && new Date(tournament.booking_opens_at).getTime() > Date.now());
  const matchStarted = !!(tournament?.match_time && new Date(tournament.match_time).getTime() <= Date.now());
  const bookingOpenCountdown = useCountdown(bookingNotOpen ? tournament.booking_opens_at : null);
  const matchCountdown = useCountdown(tournament && !bookingNotOpen && !matchStarted ? tournament.match_time : null);
  const activeCountdown = bookingNotOpen ? bookingOpenCountdown : matchCountdown;

  if (!tournament) return <TournamentDetailSkeleton />;

  const slotsLeft = Math.max(tournament.total_slots - tournament.filled_slots, 0);
  const full = slotsLeft <= 0;
  const killRate = Number(tournament.rate_per_kill) || 0;
  const fillPct = Math.min(100, Math.round((tournament.filled_slots / tournament.total_slots) * 100));

  if (success) {
    return (
      <div className="min-h-screen bg-ink relative overflow-x-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-volt/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-md mx-auto px-5 py-24 text-center relative z-10">
          <div className="glass rounded-2xl p-8">
            <div className="w-14 h-14 rounded-full bg-volt/20 border border-volt/40 text-volt flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2 text-white">You're in!</h2>
            <p className="text-neutral-400 text-sm mb-6">
              Your entry fee was paid from your wallet and your slot is confirmed. Your room ID and password will appear in "My Bookings" closer to match time.
            </p>
            <Link to="/my-bookings" className="btn-primary inline-block">Go to My Bookings</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-neutral-200 relative overflow-x-hidden">
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-volt/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-volt/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-signal/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-16 relative z-10">

        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-volt/50 rounded-full blur opacity-75 animate-pulse-neon" />
              {tournament.banner_path ? (
                <img
                  src={fileUrl(tournament.banner_path)}
                  alt={tournament.title}
                  className="relative w-24 h-24 rounded-full border-2 border-volt/60 object-cover shadow-2xl bg-panel"
                />
              ) : (
                <div className="relative w-24 h-24 rounded-full border-2 border-volt/60 bg-panel flex items-center justify-center font-display font-bold text-2xl text-volt shadow-2xl">
                  {tournament.game_name?.slice(0, 2).toUpperCase() || 'JJ'}
                </div>
              )}
              {tournament.status === 'live' && (
                <div className="absolute -bottom-1 -right-1 bg-volt text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-volt/60 text-white">
                  Live
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-volt font-semibold uppercase tracking-wide mb-1">{tournament.game_name}</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight neon-text">
            {tournament.title}
          </h1>

          {killRate > 0 && (
            <p className="mt-3 text-sm md:text-base text-neutral-400 font-medium max-w-xl mx-auto leading-relaxed">
              Every kill get real money <span className="text-volt font-bold bg-volt/10 border border-volt/20 px-1.5 py-0.5 rounded">रू {killRate}</span>. Book your slot now and win money.
            </p>
          )}
          {tournament.notes && <p className="mt-2 text-sm text-neutral-500 max-w-xl mx-auto">{tournament.notes}</p>}

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-mono tracking-wider uppercase text-neutral-500">
            <span className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-volt" /> Anti-Cheat Enabled
            </span>
            <span className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-warn" /> Instant Verification
            </span>
            <span className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-volt" /> Premium Platform
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="relative overflow-hidden rounded-2xl glass p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase bg-volt/10 text-volt border border-volt/30 px-2.5 py-1 rounded-md">
                  {tournament.match_type || 'Match'} · {tournament.map_mode || 'TBA'}
                </span>
                {!full && !bookingNotOpen && !matchStarted && (
                  <span className="flex items-center gap-1 text-xs text-danger font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-danger" /> Filling Fast
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-sm text-neutral-400 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-volt" /> Entry Fee
                  </span>
                  <span className="text-lg font-bold text-white font-mono">रू {tournament.entry_fee}</span>
                </div>
                {killRate > 0 && (
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <span className="text-sm text-neutral-400 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-volt" /> Kill Bounty
                    </span>
                    <span className="text-sm text-neutral-200 font-medium font-mono">रू {killRate} / Kill</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-volt" /> Match Time
                  </span>
                  <span className="text-sm text-volt font-medium font-mono text-right">
                    {tournament.match_time ? new Date(tournament.match_time).toLocaleString('en-IN') : 'TBA'}
                  </span>
                </div>
              </div>
            </div>

            {(bookingNotOpen || (!matchStarted && !full)) && (
              <div className="mt-6 pt-5 border-t border-volt/10">
                <p className="text-xs uppercase tracking-wider text-neutral-500 font-mono mb-2 text-center">
                  {bookingNotOpen ? 'Booking opens in' : 'Match starts in'}
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Hrs', val: activeCountdown.days ? activeCountdown.days * 24 + activeCountdown.hours : activeCountdown.hours },
                    { label: 'Min', val: activeCountdown.minutes },
                    { label: 'Sec', val: activeCountdown.seconds }
                  ].map((u) => (
                    <div key={u.label} className="bg-panel border border-line rounded-lg py-2 col-span-1">
                      <span className="block text-2xl font-mono font-bold text-volt">{String(u.val).padStart(2, '0')}</span>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{u.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl glass p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-mono text-volt uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Live Slot Tracker
                </h4>
                <span className="text-xs font-mono text-neutral-400 bg-panel px-2 py-0.5 rounded">
                  Max: {tournament.total_slots}
                </span>
              </div>

              <div className="my-6 text-center">
                <div className="text-5xl font-mono font-extrabold text-white tracking-tight flex items-baseline justify-center">
                  <span>{tournament.filled_slots}</span>
                  <span className="text-neutral-500 text-2xl font-normal">/{tournament.total_slots}</span>
                </div>
                <div className="text-xs text-volt font-semibold uppercase mt-1 tracking-widest flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-volt animate-ping" /> Slots Occupied
                </div>
              </div>

              <div className="space-y-2">
                <div className="w-full bg-ink rounded-full h-3.5 overflow-hidden p-[2px] border border-line">
                  <div className="progress-bar-fill h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${fillPct}%` }} />
                </div>
                <div className="flex justify-between text-xs font-mono text-neutral-500">
                  <span>Progress: {fillPct}% filled</span>
                  <span className="text-volt font-bold">{slotsLeft} SLOTS LEFT!</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-volt/10 border border-volt/20 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-volt mt-0.5 shrink-0" />
              <p className="text-xs text-neutral-300 leading-normal">
                Complete your payment proof submission to guarantee your entry — slots fill up fast!
              </p>
            </div>
          </div>
        </div>

        {killRate > 0 && (
          <section className="rounded-2xl glass p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-volt" /> Live Prize Calculator
              </h3>
              <span className="text-xs text-neutral-400 font-mono bg-ink px-2 py-0.5 rounded">रू {killRate} per kill</span>
            </div>
            <p className="text-xs text-neutral-400 mb-6">Estimate your kills to see your instant payout.</p>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-neutral-300">Your Target Kills:</span>
                <span className="text-2xl font-mono font-bold text-volt bg-volt/10 px-3 py-1 rounded-md border border-volt/30">{estimatedKills}</span>
              </div>
              <input
                type="range" min="1" max="20" value={estimatedKills}
                onChange={(e) => setEstimatedKills(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-ink rounded-lg appearance-none cursor-pointer accent-volt"
              />
            </div>

            <div className="mt-6 p-4 rounded-xl bg-volt/10 border border-volt/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-neutral-400 block uppercase tracking-wider">Calculated Earnings</span>
                <span className="text-3xl font-mono font-extrabold text-volt">रू {estimatedKills * killRate}</span>
              </div>
            </div>
          </section>
        )}

        {full ? (
          <div className="rounded-2xl glass p-6 text-center text-neutral-400 mb-8">This tournament is full. Check other open matches on the home page.</div>
        ) : bookingNotOpen ? null : (
          <section className="rounded-2xl glass p-6 mb-8">
            <h3 className="text-xl font-display font-semibold text-white flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-volt" /> Lock Your Slot Now
            </h3>
            <p className="text-xs text-neutral-400 mb-6">Entry fee is paid instantly from your wallet — top up first if your balance is short.</p>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-volt/10 border border-volt/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-volt/20 text-volt"><Wallet className="w-6 h-6" /></div>
                  <div>
                    <span className="text-xs text-neutral-400 block font-mono">YOUR WALLET BALANCE</span>
                    <span className="text-2xl font-mono font-bold text-white">रू {walletBalance ?? '—'}</span>
                  </div>
                </div>
                <div className="text-xs font-mono text-neutral-400 bg-ink p-2.5 rounded-lg border border-line flex items-center gap-4">
                  <span>ENTRY FEE:</span>
                  <span className="text-volt font-bold">रू {tournament.entry_fee}</span>
                </div>
              </div>

              {walletError && <p className="text-danger text-xs">{walletError}</p>}

              <button
                onClick={handleWalletPay}
                disabled={walletPaying || !user || walletBalance == null || walletBalance < tournament.entry_fee}
                className="w-full py-3.5 px-6 rounded-xl bg-volt hover:bg-volt/80 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {walletPaying ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
                ) : !user ? 'Log in to pay from wallet' : (
                  <><Zap className="w-4 h-4" /> Confirm & Pay रू {tournament.entry_fee} from Wallet</>
                )}
              </button>
              {user && walletBalance != null && walletBalance < tournament.entry_fee && (
                <Link to="/wallet" className="block text-center text-xs text-volt hover:underline">Insufficient balance — top up your wallet</Link>
              )}
            </div>
          </section>
        )}

        <section className="rounded-2xl glass p-4">
          <div className="flex items-center justify-between mb-3 border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <MessageSquare className="w-4.5 h-4.5 text-volt" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-volt rounded-full animate-ping" />
              </div>
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">Tournament Lobby Chat</h3>
            </div>
          </div>

          <div className="bg-ink/80 border border-line rounded-xl p-3.5 h-[260px] overflow-y-auto space-y-3.5 mb-3">
            {chatDenied ? (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-neutral-500 text-sm">🔒 {chatDenied}</p>
              </div>
            ) : chatHistory.length === 0 ? (
              <p className="text-neutral-600 text-center mt-10 text-xs">No messages yet. Say hi to your squad!</p>
            ) : (
              chatHistory.map((msg, idx) => {
                const isMe = msg.sender?.id === user?.id;
                return (
                  <div key={idx} className={`flex gap-2.5 items-start text-xs ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-7 h-7 rounded-full bg-panel border border-volt/30 flex items-center justify-center text-[10px] font-bold text-volt shrink-0">
                      {(msg.sender?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className={`space-y-1 max-w-[75%] ${isMe ? 'text-right' : 'text-left'}`}>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-bold text-neutral-300">{msg.sender?.name || 'Player'}</span>
                        <span className="text-[9px] text-neutral-500 font-mono">
                          {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`p-2.5 rounded-xl inline-block text-left ${
                        isMe ? 'bg-volt text-white rounded-tr-none' : 'bg-panel text-neutral-300 rounded-tl-none border border-line'
                      }`}>
                        <p className="leading-normal break-words">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder={!user ? 'Log in to chat' : chatDenied ? 'Only approved players can chat' : 'Type message to lobby…'}
              value={chatMessage}
              disabled={!user || !!chatDenied}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 bg-ink border border-line focus:border-volt rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button type="submit" disabled={!user || !!chatDenied} className="px-4 bg-volt hover:bg-volt/80 text-white rounded-xl flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

        <footer className="mt-8 text-center text-[10px] text-neutral-600 font-mono">
          <p>© {new Date().getFullYear()} Jay Janaki Tournament Centre. All rights reserved.</p>
          <p className="mt-1"><Link to="/contact" className="hover:text-volt">Need help? Contact support</Link></p>
        </footer>
      </div>
    </div>
  );
}
