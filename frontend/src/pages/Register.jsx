import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const SECURITY_QUESTIONS = [
  'What is your favorite in-game weapon?',
  'What was the name of your first pet?',
  "What is your mother's maiden name?",
  'What was your childhood nickname?',
  'Which city were you born in?',
  'Other (write your own)'
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: '', phone: '', password: '', game_uid: '', in_game_name: '',
    security_question: SECURITY_QUESTIONS[0], custom_question: '', security_answer: '',
    referral_code: searchParams.get('ref') || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const isCustom = form.security_question === 'Other (write your own)';
    const finalQuestion = isCustom ? form.custom_question.trim() : form.security_question;
    if (isCustom && !finalQuestion) {
      setError('Please write your own security question.');
      return;
    }
    if (!form.security_answer.trim()) {
      setError('Please give an answer to your security question.');
      return;
    }

    setLoading(true);
    try {
      await register(form.name, form.phone, form.password, form.game_uid, form.in_game_name, finalQuestion, form.security_answer, form.referral_code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl font-bold mb-1">Create your account</h1>
      <p className="text-white/50 mb-8">Sign up to start joining tournament rooms.</p>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <p className="text-danger text-sm">{error}</p>}
        <div>
          <label className="field-label">Full name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Game UID</label>
          <input required className="input" value={form.game_uid} onChange={(e) => setForm({ ...form, game_uid: e.target.value })} placeholder="Your unique game ID" />
        </div>
        <div>
          <label className="field-label">In-game nickname</label>
          <input required className="input" value={form.in_game_name} onChange={(e) => setForm({ ...form, in_game_name: e.target.value })} placeholder="Your in-game nickname (special characters allowed)" />
          <p className="text-[11px] text-white/30 mt-1">Used to match you in match results and kill payouts. Stylish fonts and special symbols are fine.</p>
        </div>
        <div>
          <label className="field-label">Phone number</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Password</label>
          <input type="password" required minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Security question</label>
          <select
            className="input"
            value={form.security_question}
            onChange={(e) => setForm({ ...form, security_question: e.target.value })}
          >
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          <p className="text-[11px] text-white/30 mt-1">Used to verify it's you if you ever forget your password.</p>
        </div>
        {form.security_question === 'Other (write your own)' && (
          <div>
            <label className="field-label">Your question</label>
            <input required className="input" value={form.custom_question} onChange={(e) => setForm({ ...form, custom_question: e.target.value })} />
          </div>
        )}
        <div>
          <label className="field-label">Your answer</label>
          <input required className="input" value={form.security_answer} onChange={(e) => setForm({ ...form, security_answer: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Referral code (optional)</label>
          <input className="input" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value })} placeholder="Friend's Game UID" />
          <p className="text-[11px] text-white/30 mt-1">Got invited by a friend? Enter their Game UID — you'll both get a wallet bonus once you join and actually play your first tournament.</p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="text-sm text-white/50 text-center">
          Already have an account? <Link to="/login" className="text-volt hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
