import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fileUrl } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ProfileSkeleton } from '../components/SkeletonLoader.jsx';

export default function Profile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  function load() {
    api.get('/auth/me').then((res) => setProfile(res.data));
  }
  useEffect(load, []);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const data = new FormData();
      data.append('avatar', file);
      const res = await api.put('/auth/me/avatar', data);
      updateUser(res.data.user);
      load();
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Could not upload picture.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarError('');
    try {
      const res = await api.delete('/auth/me/avatar');
      updateUser(res.data.user);
      load();
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Could not remove picture.');
    }
  }

  if (!profile) return <ProfileSkeleton />;

  const s = profile.stats;

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Your Account</p>

      <div className="flex items-center gap-4 mb-1">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-full overflow-hidden bg-panel border border-line hover:border-volt/50 transition flex items-center justify-center text-xl font-bold text-white/70"
            title="Change profile picture"
          >
            {profile.avatar_path ? (
              <img src={fileUrl(profile.avatar_path)} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </button>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-volt border-2 border-ink flex items-center justify-center text-[11px]">
            📷
          </span>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold mb-1">{profile.name}</h1>
          <p className="text-white/50">Game UID: <span className="font-mono">{profile.game_uid}</span></p>
        </div>
      </div>

      <div className="mb-8 mt-1 flex items-center gap-3">
        {avatarUploading && <p className="text-xs text-white/40">Uploading...</p>}
        {avatarError && <p className="text-xs text-danger">{avatarError}</p>}
        {profile.avatar_path && !avatarUploading && (
          <button type="button" onClick={removeAvatar} className="text-xs text-white/40 hover:text-danger">
            Remove picture
          </button>
        )}
      </div>

      <Link to="/wallet" className="card p-5 mb-6 flex items-center justify-between hover:border-volt/50 transition">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Wallet Balance</p>
          <p className="font-display text-3xl font-black text-volt">रू {profile.wallet_balance ?? 0}</p>
        </div>
        <span className="text-white/40">→</span>
      </Link>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold">{s.total_bookings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Joined</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold">{s.approved_bookings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Approved</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold text-volt">{s.wins}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Wins 🏆</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-mono text-2xl font-bold text-volt">रू {s.total_winnings}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Won</p>
        </div>
      </div>

      <div className="flex justify-end mb-6 -mt-4">
        <Link to="/leaderboard" className="text-sm text-volt hover:underline">See leaderboard →</Link>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-1">Invite friends, earn रू</h2>
        <p className="text-white/50 text-sm mb-3">Share your Game UID as a referral code. When a friend signs up with it, joins a tournament, and actually plays the match, you both get a wallet bonus.</p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono" value={profile.game_uid} />
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(profile.game_uid); setCopiedReferral(true); setTimeout(() => setCopiedReferral(false), 2000); }}
            className="btn-secondary !px-4 shrink-0"
          >
            {copiedReferral ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <Link to="/settings" className="card p-5 flex items-center justify-between hover:border-volt/50 transition">
        <div>
          <p className="font-semibold text-sm">Account settings</p>
          <p className="text-xs text-white/40 mt-0.5">Edit details, change password, security question, and logout</p>
        </div>
        <span className="text-white/40">→</span>
      </Link>
    </div>
  );
}
