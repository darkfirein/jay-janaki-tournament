import React, { useEffect, useState } from 'react';
import api, { fileUrl } from '../../api.js';
import { ListSkeleton } from '../../components/SkeletonLoader.jsx';

const HERO_DEFAULTS = {
  hero_badge: '', hero_quote: '', hero_heading_line1: '', hero_heading_line2: '', hero_heading_highlight: '',
  hero_paragraph: '', hero_stat1_value: '', hero_stat1_label: '', hero_stat2_value: '', hero_stat2_label: '',
  hero_stat3_value: '', hero_stat3_label: '', hero_cta_text: ''
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    site_name: '', upi_id: '', payment_instructions: '',
    rules_text: '', contact_note: '', contact_email: '', contact_phone: '', auto_approve_max_amount: '0'
  });
  const [heroForm, setHeroForm] = useState(HERO_DEFAULTS);
  const [qrFile, setQrFile] = useState(null);
  const [saved, setSaved] = useState(false);
  const [heroSaved, setHeroSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then((res) => {
      setSettings(res.data);
      setForm({
        site_name: res.data.site_name || '',
        upi_id: res.data.upi_id || '',
        payment_instructions: res.data.payment_instructions || '',
        rules_text: res.data.rules_text || '',
        contact_note: res.data.contact_note || '',
        contact_email: res.data.contact_email || '',
        contact_phone: res.data.contact_phone || '',
        auto_approve_max_amount: res.data.auto_approve_max_amount || '0'
      });
      const hero = {};
      Object.keys(HERO_DEFAULTS).forEach((key) => { hero[key] = res.data[key] || ''; });
      setHeroForm(hero);
    });
  }, []);

  async function save(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('site_name', form.site_name);
    fd.append('upi_id', form.upi_id);
    fd.append('payment_instructions', form.payment_instructions);
    fd.append('rules_text', form.rules_text);
    fd.append('contact_note', form.contact_note);
    fd.append('contact_email', form.contact_email);
    fd.append('contact_phone', form.contact_phone);
    fd.append('auto_approve_max_amount', form.auto_approve_max_amount);
    if (qrFile) fd.append('qr_image', qrFile);

    const { data } = await api.put('/admin/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setSettings(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function saveHero(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(heroForm).forEach(([key, value]) => fd.append(key, value));

    const { data } = await api.put('/admin/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setSettings(data);
    setHeroSaved(true);
    setTimeout(() => setHeroSaved(false), 2500);
  }

  if (!settings) return <ListSkeleton rows={4} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">Payment Settings</h1>
        <p className="text-white/50 mb-6">This QR code and UPI ID show to players on every tournament's payment page.</p>

        <form onSubmit={save} className="card p-6 space-y-4 max-w-lg">
          {saved && <p className="text-signal text-sm">Saved.</p>}

          <div>
            <label className="field-label">Site name</label>
            <input className="input" value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Account Number</label>
            <input className="input" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="e.g. 123456789012" />
          </div>
          <div>
            <label className="field-label">Payment instructions (shown to players)</label>
            <textarea rows={3} className="input" value={form.payment_instructions} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Your payment QR code image</label>
            {settings.qr_image_path && (
              <img src={fileUrl(settings.qr_image_path)} alt="Current QR" className="w-32 h-32 rounded-xl border border-line object-cover mb-3" />
            )}
            <input type="file" accept="image/*" className="input file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-volt file:text-white file:text-sm" onChange={(e) => setQrFile(e.target.files[0])} />
          </div>

          <div className="border-t border-line pt-4">
            <label className="field-label">Rules (shown on the public Rules page)</label>
            <textarea rows={6} className="input" value={form.rules_text} onChange={(e) => setForm({ ...form, rules_text: e.target.value })} placeholder="One rule per line" />
          </div>
          <div>
            <label className="field-label">Contact intro note</label>
            <textarea rows={2} className="input" value={form.contact_note} onChange={(e) => setForm({ ...form, contact_note: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Support email</label>
              <input className="input" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Support phone</label>
              <input className="input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <label className="field-label">Auto-approve payments up to (रू)</label>
            <input
              type="number" min="0" className="input" value={form.auto_approve_max_amount}
              onChange={(e) => setForm({ ...form, auto_approve_max_amount: e.target.value })}
            />
            <p className="text-[11px] text-white/30 mt-1">
              Entry fees at or below this amount are instantly approved if the UTR number the player typed can be read straight off their screenshot (via OCR). Set to 0 to disable — everything then goes to manual review as before. Requires GOOGLE_VISION_API_KEY to be configured on the server.
            </p>
          </div>

          <button type="submit" className="btn-primary">Save settings</button>
        </form>
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold mb-1">Homepage Hero</h1>
        <p className="text-white/50 mb-6">The banner text at the top of the homepage — badge, heading, stats and the call-to-action button.</p>

        <form onSubmit={saveHero} className="card p-6 space-y-4 max-w-lg">
          {heroSaved && <p className="text-signal text-sm">Saved.</p>}

          <div>
            <label className="field-label">Small badge text</label>
            <input className="input" value={heroForm.hero_badge} onChange={(e) => setHeroForm({ ...heroForm, hero_badge: e.target.value })} placeholder="e.g. Nepal's Prestige Gaming Hub" />
          </div>
          <div>
            <label className="field-label">Quote line (shown in orange, italic)</label>
            <input className="input" value={heroForm.hero_quote} onChange={(e) => setHeroForm({ ...heroForm, hero_quote: e.target.value })} placeholder="e.g. Game timi khela, paise hami dinchham!" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Heading — line 1</label>
              <input className="input" value={heroForm.hero_heading_line1} onChange={(e) => setHeroForm({ ...heroForm, hero_heading_line1: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Heading — line 2</label>
              <input className="input" value={heroForm.hero_heading_line2} onChange={(e) => setHeroForm({ ...heroForm, hero_heading_line2: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Heading highlight (gradient colored line)</label>
            <input className="input" value={heroForm.hero_heading_highlight} onChange={(e) => setHeroForm({ ...heroForm, hero_heading_highlight: e.target.value })} placeholder="e.g. Claim Your Glory!" />
          </div>
          <div>
            <label className="field-label">Paragraph</label>
            <textarea rows={3} className="input" value={heroForm.hero_paragraph} onChange={(e) => setHeroForm({ ...heroForm, hero_paragraph: e.target.value })} />
          </div>

          <div className="border-t border-line pt-4 grid grid-cols-3 gap-3">
            <div>
              <label className="field-label">Stat 1 value</label>
              <input className="input" value={heroForm.hero_stat1_value} onChange={(e) => setHeroForm({ ...heroForm, hero_stat1_value: e.target.value })} placeholder="Rs. 10L+" />
              <label className="field-label mt-2">Stat 1 label</label>
              <input className="input" value={heroForm.hero_stat1_label} onChange={(e) => setHeroForm({ ...heroForm, hero_stat1_label: e.target.value })} placeholder="Monthly Prizes" />
            </div>
            <div>
              <label className="field-label">Stat 2 value</label>
              <input className="input" value={heroForm.hero_stat2_value} onChange={(e) => setHeroForm({ ...heroForm, hero_stat2_value: e.target.value })} placeholder="Instant" />
              <label className="field-label mt-2">Stat 2 label</label>
              <input className="input" value={heroForm.hero_stat2_label} onChange={(e) => setHeroForm({ ...heroForm, hero_stat2_label: e.target.value })} placeholder="eSewa & Khalti" />
            </div>
            <div>
              <label className="field-label">Stat 3 value</label>
              <input className="input" value={heroForm.hero_stat3_value} onChange={(e) => setHeroForm({ ...heroForm, hero_stat3_value: e.target.value })} placeholder="100%" />
              <label className="field-label mt-2">Stat 3 label</label>
              <input className="input" value={heroForm.hero_stat3_label} onChange={(e) => setHeroForm({ ...heroForm, hero_stat3_label: e.target.value })} placeholder="Anti-Cheat Safe" />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <label className="field-label">Button text</label>
            <input className="input" value={heroForm.hero_cta_text} onChange={(e) => setHeroForm({ ...heroForm, hero_cta_text: e.target.value })} placeholder="Start Winning Now" />
            <p className="text-[11px] text-white/30 mt-1">The button scrolls players down to the tournament list — its destination can't be changed here.</p>
          </div>

          <button type="submit" className="btn-primary">Save hero section</button>
        </form>
      </div>
    </div>
  );
}
