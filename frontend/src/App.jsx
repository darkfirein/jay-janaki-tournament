import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import PushPrompt from './components/PushPrompt.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Register from './pages/Register.jsx';
import TournamentDetail from './pages/TournamentDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Results from './pages/Results.jsx';
import Rules from './pages/Rules.jsx';
import Contact from './pages/Contact.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Withdraw from './pages/Withdraw.jsx';
import Wallet from './pages/Wallet.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import EsewaCallback from './pages/EsewaCallback.jsx';
import KhaltiCallback from './pages/KhaltiCallback.jsx';

import AdminLayout from './pages/admin/AdminLayout.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Tournaments from './pages/admin/Tournaments.jsx';
import Bookings from './pages/admin/Bookings.jsx';
import Deposits from './pages/admin/Deposits.jsx';
import Withdrawals from './pages/admin/Withdrawals.jsx';
import AdminResults from './pages/admin/Results.jsx';
import HomeContent from './pages/admin/HomeContent.jsx';
import Users from './pages/admin/Users.jsx';
import UserDetail from './pages/admin/UserDetail.jsx';
import TournamentBookings from './pages/admin/TournamentBookings.jsx';
import SettingsPage from './pages/admin/Settings.jsx';
import Analytics from './pages/admin/Analytics.jsx';
import Security from './pages/admin/Security.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <PushPrompt />
      <main className="flex-1">
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/results" element={<Results />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/withdraw"
          element={
            <ProtectedRoute>
              <Withdraw />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/esewa/callback"
          element={
            <ProtectedRoute>
              <EsewaCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/khalti/callback"
          element={
            <ProtectedRoute>
              <KhaltiCallback />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="tournaments/:id" element={<TournamentBookings />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="withdrawals" element={<Withdrawals />} />
          <Route path="results" element={<AdminResults />} />
          <Route path="home-content" element={<HomeContent />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="security" element={<Security />} />
        </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
