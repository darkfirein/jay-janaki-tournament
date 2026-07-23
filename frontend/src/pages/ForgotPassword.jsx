import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';

const SECURITY_QUESTIONS = [
  'What is your favorite in-game weapon?',
  'What was the name of your first pet?',
  "What is your mother's maiden name?",
  'What was your childhood nickname?',
  'Which city were you born in?',
  'Other (I wrote my own)'
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  // 'question' = verify using the security question I set at signup
  // 'legacy'   = I never set a security question, use name + phone instead
  const [method, setMethod] = useState('question');
  const [form, setForm] = useState({
    game_uid: '', security_question: SECURITY_QUESTIONS[0], security_answer: '',
    name: '', phone: '', new_password: '', confirm_password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.new_password !== form.confirm_password) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', {
        game_uid: form.game_uid,
        security_answer: method === 'question' ? form.security_answer : undefined,
        name: method === 'legacy' ? form.name : undefined,
        phone: method === 'legacy' ? form.phone : undefined,
        new_password: form.new_password
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold mb-3">Password reset ✅</h1>
        <p className="text-white/50 mb-8">Your password has been updated. You can log in with your new password now.</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Go to login</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl font-bold mb-1">Forgot password</h1>
      <p className="text-white/50 mb-8">Verify it's you below to set a new password.</p>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <p className="text-danger text-sm">{error}</p>}

        <div>
          <label className="field-label">Game UID</label>
          <input
            required className="input"
            value={form.game_uid}
            onChange={(e) => setForm({ ...form, game_uid: e.target.value })}
          />
        </div>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMethod('question')}
            className={`flex-1 py-2 rounded ${method === 'question' ? 'bg-volt text-black font-semibold' : 'bg-white/5 text-white/50'}`}
          >
            I set a security question
          </button>
          <button
            type="button"
            onClick={() => setMethod('legacy')}
            className={`flex-1 py-2 rounded ${method === 'legacy' ? 'bg-volt text-black font-semibold' : 'bg-white/5 text-white/50'}`}
          >
            I never set one
          </button>
        </div>

        {method === 'question' ? (
          <>
            <div>
              <label className="field-label">Which question did you set?</label>
              <select
                className="input"
                value={form.security_question}
                onChange={(e) => setForm({ ...form, security_question: e.target.value })}
              >
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <p className="text-[11px] text-white/30 mt-1">This is just to jog your memory — only the answer below is checked.</p>
            </div>
            <div>
              <label className="field-label">Your answer</label>
              <input
                required className="input"
                value={form.security_answer}
                onChange={(e) => setForm({ ...form, security_answer: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="field-label">Full name (as registered)</label>
              <input
                required className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Phone number (as registered)</label>
              <input
                required className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </>
        )}

        <div>
          <label className="field-label">New password</label>
          <input
            type="password" required className="input" minLength={6}
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Confirm new password</label>
          <input
            type="password" required className="input" minLength={6}
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
        <p className="text-sm text-white/50 text-center">
          Remembered it? <Link to="/login" className="text-volt hover:underline">Back to login</Link>
        </p>
      </form>
    </div>
  );
}
