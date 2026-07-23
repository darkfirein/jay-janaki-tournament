import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Footer() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-line mt-16">
      <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-white/30 text-xs">© {new Date().getFullYear()} Jay Janaki Tournament Centre</p>
        <nav className="flex items-center gap-5 text-sm text-white/60">
          <Link to="/results" className="hover:text-volt transition">Results</Link>
          <Link to="/rules" className="hover:text-volt transition">Rules</Link>
          <Link to="/contact" className="hover:text-volt transition">Contact &amp; Support</Link>
          {user && (
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="hover:text-danger transition"
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </footer>
  );
}
