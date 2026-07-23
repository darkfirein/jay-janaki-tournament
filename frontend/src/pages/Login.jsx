import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ game_uid: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.game_uid, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl font-bold mb-1">Welcome back</h1>
      <p className="text-white/50 mb-8">Log in to join tournaments and check your room details.</p>

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
        <div>
          <label className="field-label">Password</label>
          <input
            type="password" required className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="text-right mt-1.5">
            <Link to="/forgot-password" className="text-xs text-white/40 hover:text-volt">Forgot password?</Link>
          </p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-sm text-white/50 text-center">
          New here? <Link to="/register" className="text-volt hover:underline">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
