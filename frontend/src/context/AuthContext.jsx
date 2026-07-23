import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // The auth cookie is httpOnly, so JS can't read it to know if a session
  // exists — the only way to find out is to ask the backend. This gate stops
  // ProtectedRoute from bouncing everyone to /login for an instant on every
  // page load while that first check is in flight.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me', { skipAuthRedirect: true })
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(game_uid, password) {
    const { data } = await api.post('/auth/login', { game_uid, password });
    setUser(data.user);
    return data.user;
  }

  async function register(name, phone, password, game_uid, in_game_name, security_question, security_answer, referral_code) {
    const { data } = await api.post('/auth/register', { name, phone, password, game_uid, in_game_name, security_question, security_answer, referral_code });
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setUser(null);
    api.post('/auth/logout').catch(() => {
      // best-effort — UI has already logged out locally either way
    });
  }

  function updateUser(newUser) {
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
