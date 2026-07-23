import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fileUrl } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

const emptyForm = {
  id: null, title: '', game_name: '', entry_fee: '', total_slots: '',
  match_time: '', booking_opens_at: '', map_mode: '', match_type: '', prize_pool: '', notes: '', status: 'upcoming', result_note: '',
  banner_path: null, recurrence: ''
};

export default function Tournaments() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [removeBanner, setRemoveBanner] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/tournaments').then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function edit(t) {
    setForm({
      ...t,
      match_time: t.match_time ? t.match_time.slice(0, 16) : '',
      booking_opens_at: t.booking_opens_at ? t.booking_opens_at.slice(0, 16) : '',
      recurrence: t.recurrence || ''
    });
    setBannerFile(null);
    setBannerPreview('');
    setRemoveBanner(false);
    setShowForm(true);
  }

  function newTournament() {
    setForm(emptyForm);
    setBannerFile(null);
    setBannerPreview('');
    setRemoveBanner(false);
    setShowForm(true);
  }

  function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setRemoveBanner(false);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'id' || key === 'banner_path') return;
        data.append(key, value ?? '');
      });
      if (bannerFile) data.append('banner', bannerFile);
      if (removeBanner) data.append('remove_banner', 'true');

      if (form.id) {
        await api.put(`/admin/tournaments/${form.id}`, data);
      } else {
        await api.post('/admin/tournaments', data);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save tournament.');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this tournament and all its bookings? This cannot be undone.')) return;
    await api.delete(`/admin/tournaments/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Tournaments</h1>
          <p className="text-white/50">Create matches, then send the room ID &amp; password to everyone at once.</p>
        </div>
        <button onClick={newTournament} className="btn-primary">+ New tournament</button>
      </div>


      {showForm && (
        <form onSubmit={save} className="card p-6 mb-6 space-y-4">
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Title</label>
              <input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Squad Showdown #12" />
            </div>
            <div>
              <label className="field-label">Game</label>
              <input required className="input" value={form.game_name} onChange={(e) => setForm({ ...form, game_name: e.target.value })} placeholder="e.g. BGMI / Free Fire" />
            </div>
            <div>
              <label className="field-label">Entry fee (रू)</label>
              <input required type="number" min="0" className="input" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Total slots</label>
              <input required type="number" min="1" className="input" value={form.total_slots} onChange={(e) => setForm({ ...form, total_slots: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Match time</label>
              <input type="datetime-local" className="input" value={form.match_time} onChange={(e) => setForm({ ...form, match_time: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Booking opens at</label>
              <input type="datetime-local" className="input" value={form.booking_opens_at} onChange={(e) => setForm({ ...form, booking_opens_at: e.target.value })} />
              <p className="text-[11px] text-white/30 mt-1">Leave blank if booking should be open right away.</p>
            </div>
            <div>
              <label className="field-label">Combat map</label>
              <input className="input" value={form.map_mode} onChange={(e) => setForm({ ...form, map_mode: e.target.value })} placeholder="e.g. Bermuda, Erangel" />
            </div>
            <div>
              <label className="field-label">Match mode</label>
              <select className="input" value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })}>
                <option value="">Not set</option>
                <option value="Solo">Solo</option>
                <option value="Duo">Duo</option>
                <option value="Squad">Squad</option>
              </select>
            </div>
            <div>
              <label className="field-label">Prize pool</label>
              <input className="input" value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} placeholder="e.g. रू 5000" />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="field-label">Repeats</label>
              <select className="input" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <p className="text-[11px] text-white/30 mt-1">
                {form.recurrence_parent_id
                  ? 'This is an auto-created occurrence of a recurring tournament.'
                  : 'A new occurrence is created automatically once this match time has passed, at the same weekday/time.'}
              </p>
            </div>
          </div>
          <div>
            <label className="field-label">Tournament photo / banner</label>
            {(bannerPreview || (form.banner_path && !removeBanner)) && (
              <div className="relative mb-2 inline-block">
                <img
                  src={bannerPreview || fileUrl(form.banner_path)}
                  alt="Tournament banner"
                  className="w-full max-w-xs h-32 object-cover rounded-lg border border-line"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBannerFile(null);
                    setBannerPreview('');
                    setRemoveBanner(true);
                  }}
                  className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs rounded px-2 py-1 hover:bg-danger/80"
                >
                  Remove
                </button>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleBannerChange} className="input" />
            <p className="text-[11px] text-white/30 mt-1">Shown on the home page card and the tournament detail page. JPG/PNG, up to 5MB.</p>
          </div>
          <div>
            <label className="field-label">Rules (shown in the "Specs & Rules" popup — write one rule per line)</label>
            <textarea
              className="input"
              rows={4}
              placeholder={'Standard Solo BR Rules.\nTeaming up with enemies will result in immediate ban from all future tournaments.'}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {form.status === 'completed' && (
            <div>
              <label className="field-label">Result summary (shown on Results page after match ends)</label>
              <textarea className="input" rows={2} value={form.result_note} onChange={(e) => setForm({ ...form, result_note: e.target.value })} placeholder="e.g. Great final circle fight, thanks to everyone who joined!" />
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {loading && <ListSkeleton rows={3} />}

      <div className="space-y-3">
        {!loading && list.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {t.banner_path && (
                  <img src={fileUrl(t.banner_path)} alt="" className="w-14 h-14 rounded-lg object-cover border border-line shrink-0" />
                )}
                <div>
                  <p className="text-xs text-volt uppercase font-semibold">
                    {t.game_name} · {t.status}
                    {t.recurrence && <span className="text-white/40"> · repeats {t.recurrence}</span>}
                    {t.recurrence_parent_id && <span className="text-white/40"> · auto-created</span>}
                  </p>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-white/40">रू {t.entry_fee} · {t.filled_slots}/{t.total_slots} slots filled</p>
                  {t.approved_count > 0 && (
                    <p className="text-xs mt-1">
                      <span className="text-signal">{t.approved_count} approved</span>
                      {t.waiting_count > 0 && <span className="text-warn"> · {t.waiting_count} waiting for room</span>}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => edit(t)} className="btn-secondary !py-2 !px-3 text-sm">Edit</button>
                <button onClick={() => remove(t.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger">Delete</button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-line">
              <Link to={`/admin/tournaments/${t.id}`} className="btn-primary !py-2 !px-4 text-sm inline-block">
                View players &amp; payments →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
