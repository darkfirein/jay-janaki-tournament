import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { ListSkeleton } from '../components/SkeletonLoader.jsx';

export default function Contact() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/settings').then((res) => setSettings(res.data));
  }, []);

  if (!settings) return <div className="max-w-2xl mx-auto px-5 py-10"><ListSkeleton rows={2} /></div>;

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="text-volt text-xs font-semibold tracking-[0.2em] uppercase mb-2">We're here to help</p>
      <h1 className="font-display text-4xl font-bold mb-1">Contact &amp; Support</h1>
      <p className="text-white/50 mb-8">{settings.contact_note}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <a href={`mailto:${settings.contact_email}`} className="card p-5 hover:border-volt/50 transition block">
          <p className="text-xs text-volt uppercase font-semibold mb-2">Email</p>
          <p className="font-semibold break-all">{settings.contact_email}</p>
        </a>
        <a href={`tel:${settings.contact_phone}`} className="card p-5 hover:border-volt/50 transition block">
          <p className="text-xs text-volt uppercase font-semibold mb-2">Phone</p>
          <p className="font-semibold">{settings.contact_phone}</p>
        </a>
      </div>

      <div className="card p-5 mt-4">
        <p className="text-xs text-white/40 uppercase font-semibold mb-2">Before you reach out</p>
        <p className="text-white/60 text-sm leading-relaxed">
          For payment issues, keep your UTR number and payment screenshot ready — it helps us verify faster.
          For match issues, mention your tournament name and room ID.
        </p>
      </div>
    </div>
  );
}
