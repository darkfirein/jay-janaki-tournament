import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { ListSkeleton } from '../components/SkeletonLoader.jsx';

const statusLabel = { pending: 'Verification pending', approved: 'Approved', rejected: 'Rejected' };
const statusClass = { pending: 'pill-pending', approved: 'pill-approved', rejected: 'pill-rejected' };

function ReviewBox({ booking, review, onSaved }) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (!rating) return;
    setSaving(true);
    try {
      await api.post(`/bookings/${booking.id}/review`, { rating, comment });
      setSaved(true);
      onSaved(booking.tournament_id, { rating, comment });
    } finally {
      setSaving(false);
    }
  }

  if (review && !saved) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs text-white/40 mb-1">Your rating</p>
        <p className="text-lg">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
        {review.comment && <p className="text-sm text-white/60 mt-1">{review.comment}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {saved ? (
        <p className="text-sm text-signal">Thanks for the feedback! 🙌</p>
      ) : (
        <>
          <p className="text-xs text-white/40 mb-1">How was this match?</p>
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className="text-2xl leading-none">
                {n <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>
          <textarea
            className="input mb-2" rows={2} placeholder="Optional comment"
            value={comment} onChange={(e) => setComment(e.target.value)}
          />
          <button type="button" onClick={submit} disabled={!rating || saving} className="btn-secondary !py-1.5 !px-3 text-sm">
            {saving ? 'Submitting…' : 'Submit rating'}
          </button>
        </>
      )}
    </div>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings/my').then((res) => setBookings(res.data)).finally(() => setLoading(false));
    api.get('/bookings/reviews/mine').then((res) => {
      const map = {};
      res.data.forEach((r) => (map[r.tournament_id] = r));
      setReviews(map);
    }).catch(() => {});
  }, []);

  function handleReviewSaved(tournamentId, review) {
    setReviews((prev) => ({ ...prev, [tournamentId]: review }));
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">My Bookings</h1>
      <p className="text-white/50 mb-8">Track verification status and get your room credentials here.</p>

      {loading && <ListSkeleton rows={3} />}
      {!loading && bookings.length === 0 && (
        <div className="card p-8 text-center text-white/50">You haven't joined any tournaments yet.</div>
      )}

      <div className="space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-volt font-semibold uppercase tracking-wide">{b.game_name}</p>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
              </div>
              <span className={`pill ${statusClass[b.status]}`}>{statusLabel[b.status]}</span>
            </div>

            <div className="text-sm text-white/50 mb-2">UTR: <span className="font-mono text-white/80">{b.utr_number}</span></div>

            {b.status === 'approved' && b.room_id && (
              <div className="mt-3 bg-signal/10 border border-signal/30 rounded-xl p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-signal uppercase mb-1">Room ID</p>
                  <p className="font-mono text-lg font-semibold">{b.room_id}</p>
                </div>
                <div>
                  <p className="text-xs text-signal uppercase mb-1">Password</p>
                  <p className="font-mono text-lg font-semibold">{b.room_password}</p>
                </div>
              </div>
            )}

            {b.status === 'approved' && !b.room_id && (
              <div className="mt-3 bg-warn/10 border border-warn/30 rounded-xl p-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-warn animate-pulse shrink-0" />
                <p className="text-sm text-warn">Payment verified — waiting for the room ID and password. It'll appear here once the admin sends it to everyone.</p>
              </div>
            )}

            {b.is_winner === 1 && (
              <div className="mt-3 bg-volt/15 border border-volt/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-volt uppercase font-semibold mb-1">🏆 You won{b.player_rank ? ` — ${b.player_rank}` : ''}!</p>
                  <p className="text-sm text-white/60">Congratulations, champion.</p>
                </div>
                <p className="font-mono text-2xl font-bold text-volt">रू {b.winning_amount}</p>
              </div>
            )}

            {b.tournament_status === 'completed' && b.result_note && (
              <p className="text-sm text-white/40 mt-3 border-t border-line pt-3">{b.result_note}</p>
            )}

            {b.status === 'rejected' && b.admin_note && (
              <div className="mt-3 bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger">
                {b.admin_note}
              </div>
            )}

            {b.status === 'pending' && (
              <p className="text-sm text-white/40 mt-1">We're verifying your payment. Room details will appear here once approved.</p>
            )}

            {b.status === 'approved' && b.tournament_status === 'completed' && (
              <ReviewBox booking={b} review={reviews[b.tournament_id]} onSaved={handleReviewSaved} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
