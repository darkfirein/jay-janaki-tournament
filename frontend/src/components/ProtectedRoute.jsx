import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  // Don't redirect to /login while we're still asking the backend whether
  // the session cookie is valid — that would bounce a logged-in user for
  // an instant on every refresh.
  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}
