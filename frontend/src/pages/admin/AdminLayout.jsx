import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/tournaments', label: 'Tournaments' },
  { to: '/admin/bookings', label: 'Payment Approvals' },
  { to: '/admin/deposits', label: 'Deposits' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/results', label: 'Results' },
  { to: '/admin/home-content', label: 'Home Page Content' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/security', label: 'Security' },
  { to: '/admin/settings', label: 'Payment Settings' }
];

export default function AdminLayout() {
  return (
    <div className="max-w-6xl mx-auto px-5 py-8 grid md:grid-cols-[200px_1fr] gap-6">
      <aside className="card p-3 h-fit sticky top-20">
        <p className="text-xs text-white/40 uppercase tracking-wide px-3 py-2">Admin Panel</p>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                  isActive ? 'bg-volt/15 text-volt font-semibold' : 'text-white/70 hover:bg-panel'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
