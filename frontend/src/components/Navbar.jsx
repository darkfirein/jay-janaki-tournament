import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { fileUrl } from '../api.js';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full hover:bg-panel transition flex items-center justify-center text-white/70 hover:text-volt"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-signal text-ink text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card p-0 z-50 !border-line shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <p className="font-semibold text-sm">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-volt hover:underline">Mark all read</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.link || '#'}
                  onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                  className={`block px-4 py-3 border-b border-line last:border-0 hover:bg-panel/60 transition ${!n.is_read ? 'bg-volt/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-volt mt-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90">{n.title}</p>
                      {n.body && <p className="text-xs text-white/50 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MoreMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);

  const publicLinks = [
    { to: '/leaderboard', label: 'Leaderboard', icon: '📊' },
    { to: '/rules', label: 'Rules', icon: '📜' },
    { to: '/results', label: 'Results', icon: '🏆' },
    { to: '/contact', label: 'Contact & Support', icon: '💬' }
  ];
  const accountLinks = user
    ? [
        { to: '/profile', label: 'Profile', icon: '👤' },
        { to: '/settings', label: 'Settings', icon: '⚙️' },
        { to: '/my-bookings', label: 'My Bookings', icon: '🎮' },
        { to: '/wallet', label: 'Wallet', icon: '💰' },
        ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin Panel', icon: '🛠' }] : [])
      ]
    : [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full hover:bg-panel transition flex items-center justify-center text-white/70 hover:text-volt text-lg leading-none"
        title="Menu"
      >
        ☰
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 card p-1.5 z-50 !border-line shadow-xl">
            {accountLinks.length > 0 && (
              <>
                {accountLinks.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-panel transition text-sm text-white/80"
                  >
                    <span>{item.icon}</span>{item.label}
                  </Link>
                ))}
                <div className="h-px bg-line my-1.5" />
              </>
            )}
            {publicLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-panel transition text-sm text-white/80"
              >
                <span>{item.icon}</span>{item.label}
              </Link>
            ))}
            {user && (
              <>
                <div className="h-px bg-line my-1.5" />
                <button
                  onClick={() => { setOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-danger/10 transition text-sm text-danger"
                >
                  <span>🚪</span>Logout
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="border-b border-line sticky top-0 z-30 bg-ink/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {loading ? null : <MoreMenu user={user} onLogout={handleLogout} />}

          <Link to="/" className="font-display flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-volt/15 border border-volt/40 flex items-center justify-center text-volt font-bold text-sm shrink-0">
              JJ
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-wide">Jay Janaki</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-volt/80 -mt-0.5">Tournament Centre</span>
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1 text-sm">
          {loading ? null : user ? (
            <>
              <NotificationBell />
              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-panel border border-line hover:border-volt/50 transition flex items-center justify-center text-xs font-bold text-white/70 hover:text-volt overflow-hidden"
                title={user.name}
              >
                {user.avatar_path ? (
                  <img src={fileUrl(user.avatar_path)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 rounded-lg hover:bg-panel transition text-white/80">
                Login
              </Link>
              <Link to="/register" className="btn-primary !py-2 !px-4 text-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
