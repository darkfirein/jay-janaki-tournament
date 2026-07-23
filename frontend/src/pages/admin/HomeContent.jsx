import React, { useEffect, useState } from 'react';
import api, { fileUrl } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

export default function HomeContent() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/announcements').then((res) => setList(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Title is required.');

    const fd = new FormData();
    fd.append('title', title);
    fd.append('body', body);
    if (image) fd.append('image', image);

    setSubmitting(true);
    try {
      await api.post('/admin/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTitle('');
      setBody('');
      setImage(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this post from the home page?')) return;
    await api.delete(`/admin/announcements/${id}`);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Home Page Content</h1>
      <p className="text-white/50 mb-6">Post photos, news, or announcements that show up on the home page.</p>

      <form onSubmit={submit} className="card p-6 mb-6 space-y-4">
        {error && <p className="text-danger text-sm">{error}</p>}
        <div>
          <label className="field-label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New tournament this weekend!" />
        </div>
        <div>
          <label className="field-label">Message (optional)</label>
          <textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Photo (optional)</label>
          <input type="file" accept="image/*" className="input file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-volt file:text-white file:text-sm" onChange={(e) => setImage(e.target.files[0])} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Posting…' : 'Post to home page'}
        </button>
      </form>

      {loading && <ListSkeleton rows={2} />}

      <div className="space-y-3">
        {!loading && list.map((a) => (
          <div key={a.id} className="card p-4 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              {a.image_path && (
                <img src={fileUrl(a.image_path)} alt={a.title} className="w-16 h-16 rounded-lg object-cover border border-line shrink-0" />
              )}
              <div>
                <p className="font-semibold">{a.title}</p>
                {a.body && <p className="text-sm text-white/50 mt-1">{a.body}</p>}
                <p className="text-xs text-white/30 mt-1">{new Date(a.created_at).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <button onClick={() => remove(a.id)} className="btn-secondary !py-2 !px-3 text-sm hover:!border-danger/60 hover:!text-danger shrink-0">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
