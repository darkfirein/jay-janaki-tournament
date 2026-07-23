import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { pushSupported, getPermissionState, isSubscribed, enablePushNotifications } from '../lib/push.js';

const DISMISS_KEY = 'push_prompt_dismissed';

export default function PushPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported()) return;
    if (getPermissionState() !== 'default') return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    isSubscribed().then((already) => {
      if (!already) setVisible(true);
    });
  }, [user?.id]);

  async function handleEnable() {
    setBusy(true);
    try {
      await enablePushNotifications();
    } catch {
      // permission denied or unsupported — just close the banner either way
    } finally {
      setBusy(false);
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, '1');
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-volt/10 border-b border-volt/30">
      <div className="max-w-5xl mx-auto px-5 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs sm:text-sm text-white/80">
          🔔 Turn on notifications — get room details &amp; results straight to your phone.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={handleEnable} disabled={busy} className="text-xs sm:text-sm font-semibold text-volt hover:underline">
            {busy ? 'Enabling…' : 'Enable'}
          </button>
          <button type="button" onClick={dismiss} className="text-xs sm:text-sm text-white/40 hover:text-white/70">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
