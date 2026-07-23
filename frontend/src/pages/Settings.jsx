import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { pushSupported, getPermissionState, isSubscribed, enablePushNotifications, disablePushNotifications } from '../lib/push.js';

const SECURITY_QUESTIONS = [
  'What is your favorite in-game weapon?',
  'What was the name of your first pet?',
  "What is your mother's maiden name?",
  'What was your childhood nickname?',
  'Which city were you born in?',
  'Other (write your own)'
];

export default function Settings() {
  const { logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', in_game_name: '' });
  const [savedInfo, setSavedInfo] = useState(false);
  const [infoError, setInfoError] = useState('');
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [sqForm, setSqForm] = useState({ current_password: '', security_question: SECURITY_QUESTIONS[0], custom_question: '', security_answer: '' });
  const [savedPw, setSavedPw] = useState(false);
  const [savedSq, setSavedSq] = useState(false);
  const [pwError, setPwError] = useState('');
  const [sqError, setSqError] = useState('');

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    isSubscribed().then(setPushSubscribed);
  }, []);

  async function togglePush() {
    setPushError('');
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await disablePushNotifications();
        setPushSubscribed(false);
      } else {
        await enablePushNotifications();
        setPushSubscribed(true);
      }
    } catch (err) {
      setPushError(err.message || 'Could not update notification settings.');
    } finally {
      setPushBusy(false);
    }
  }

  function load() {
    api.get('/auth/me').then((res) => {
      setProfile(res.data);
      setForm({ name: res.data.name, phone: res.data.phone || '', in_game_name: res.data.in_game_name || '' });
    });
  }
  useEffect(load, []);

  async function saveInfo(e) {
    e.preventDefault();
    setInfoError('');
    try {
      const { data } = await api.put('/auth/me', form);
      updateUser(data.user);
      setSavedInfo(true);
      load();
      setTimeout(() => setSavedInfo(false), 2500);
    } catch (err) {
      setInfoError(err.response?.data?.error || 'Could not save changes.');
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    try {
      await api.put('/auth/me/password', pwForm);
      setPwForm({ current_password: '', new_password: '' });
      setSavedPw(true);
      setTimeout(() => setSavedPw(false), 2500);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Could not change password.');
    }
  }

  async function saveSecurityQuestion(e) {
    e.preventDefault();
    setSqError('');

    const isCustom = sqForm.security_question === 'Other (write your own)';
    const finalQuestion = isCustom ? sqForm.custom_question.trim() : sqForm.security_question;
    if (isCustom && !finalQuestion) {
      setSqError('Please write your own security question.');
      return;
    }

    try {
      await api.put('/auth/me/security-question', {
        current_password: sqForm.current_password,
        security_question: finalQuestion,
        security_answer: sqForm.security_answer
      });
      setSqForm({ current_password: '', security_question: SECURITY_QUESTIONS[0], custom_question: '', security_answer: '' });
      setSavedSq(true);
      api.get('/auth/me').then((res) => setProfile(res.data));
      setTimeout(() => setSavedSq(false), 2500);
    } catch (err) {
      setSqError(err.response?.data?.error || 'Could not save security question.');
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">Account</p>
      <h1 className="font-display text-4xl font-bold mb-8">Settings</h1>

      <form onSubmit={saveInfo} className="card p-6 space-y-4 mb-6">
        <h2 className="font-display text-xl font-bold">Edit details</h2>
        {infoError && <p className="text-danger text-sm">{infoError}</p>}
        {savedInfo && <p className="text-signal text-sm">Saved.</p>}
        <div>
          <label className="field-label">Full name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Phone number</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="field-label">In-game nickname</label>
          <input className="input" value={form.in_game_name} onChange={(e) => setForm({ ...form, in_game_name: e.target.value })} placeholder="Special characters and stylish fonts are fine" />
        </div>
        <button type="submit" className="btn-primary">Save details</button>
      </form>

      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-bold mb-1">Push Notifications</h2>
        {!pushSupported() ? (
          <p className="text-sm text-white/40">Not supported on this browser.</p>
        ) : (
          <>
            <p className="text-white/50 text-sm mb-3">
              Booking approvals, room details, and results — straight to your phone's notification tray, even when the app isn't open.
            </p>
            {pushError && <p className="text-danger text-sm mb-3">{pushError}</p>}
            <button
              type="button"
              onClick={togglePush}
              disabled={pushBusy}
              className={pushSubscribed ? 'btn-secondary' : 'btn-primary'}
            >
              {pushBusy ? 'Please wait…' : pushSubscribed ? '✓ Notifications On — tap to turn off' : 'Enable notifications'}
            </button>
          </>
        )}
      </div>

      <Link to="/withdraw" className="card p-5 mb-6 flex items-center justify-between hover:border-volt/50 transition">
        <div>
          <p className="font-semibold text-sm">Withdraw money</p>
          <p className="text-xs text-white/40 mt-0.5">Send your wallet balance to eSewa, Khalti, or bank</p>
        </div>
        <span className="text-white/40">→</span>
      </Link>

      <form onSubmit={changePassword} className="card p-6 space-y-4 mb-6">
        <h2 className="font-display text-xl font-bold">Change password</h2>
        {pwError && <p className="text-danger text-sm">{pwError}</p>}
        {savedPw && <p className="text-signal text-sm">Password updated.</p>}
        <div>
          <label className="field-label">Current password</label>
          <input type="password" className="input" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
        </div>
        <div>
          <label className="field-label">New password</label>
          <input type="password" minLength={6} className="input" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary">Update password</button>
      </form>

      {profile && (
        <form onSubmit={saveSecurityQuestion} className="card p-6 space-y-4 mb-6">
          <h2 className="font-display text-xl font-bold">Security question</h2>
          <p className="text-white/50 text-sm">
            {profile.security_question
              ? <>Currently set to: <span className="text-white/80">{profile.security_question}</span>. Used to reset your password if you forget it.</>
              : 'Not set yet — add one so you can reset your password using it instead of name + phone.'}
          </p>
          {sqError && <p className="text-danger text-sm">{sqError}</p>}
          {savedSq && <p className="text-signal text-sm">Security question saved.</p>}
          <div>
            <label className="field-label">New security question</label>
            <select
              className="input"
              value={sqForm.security_question}
              onChange={(e) => setSqForm({ ...sqForm, security_question: e.target.value })}
            >
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          {sqForm.security_question === 'Other (write your own)' && (
            <div>
              <label className="field-label">Your question</label>
              <input required className="input" value={sqForm.custom_question} onChange={(e) => setSqForm({ ...sqForm, custom_question: e.target.value })} />
            </div>
          )}
          <div>
            <label className="field-label">Answer</label>
            <input required className="input" value={sqForm.security_answer} onChange={(e) => setSqForm({ ...sqForm, security_answer: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Current password (to confirm it's you)</label>
            <input type="password" required className="input" value={sqForm.current_password} onChange={(e) => setSqForm({ ...sqForm, current_password: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">Save security question</button>
        </form>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 border border-danger/40 text-danger rounded-xl py-3 font-semibold hover:bg-danger/10 transition"
      >
        🚪 Logout
      </button>
    </div>
  );
}
