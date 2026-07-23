import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api.js';

export default function EsewaCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking'); // checking | success | failed

  useEffect(() => {
    const encoded = searchParams.get('data');
    let transaction_uuid = null;
    if (encoded) {
      try {
        const decoded = JSON.parse(atob(encoded));
        transaction_uuid = decoded.transaction_uuid;
      } catch {
        transaction_uuid = null;
      }
    }
    if (!transaction_uuid) {
      setStatus('failed');
      return;
    }
    api
      .post('/wallet/deposit/esewa/verify', { transaction_uuid })
      .then((res) => setStatus(res.data.success ? 'success' : 'failed'))
      .catch(() => setStatus('failed'));
  }, [searchParams]);

  return (
    <div className="max-w-md mx-auto px-5 py-16 text-center">
      <div className="card p-8">
        {status === 'checking' && <p className="text-white/60">Confirming your eSewa payment…</p>}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-signal/15 text-signal flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <h2 className="font-display text-2xl font-bold mb-2">Wallet topped up</h2>
            <p className="text-white/60 mb-6">Your eSewa payment was successful.</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="w-14 h-14 rounded-full bg-danger/15 text-danger flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
            <h2 className="font-display text-2xl font-bold mb-2">Payment not confirmed</h2>
            <p className="text-white/60 mb-6">If money was deducted, it will be reflected once eSewa confirms it — check back in a few minutes.</p>
          </>
        )}
        <Link to="/wallet" className="btn-primary inline-block">Go to Wallet</Link>
      </div>
    </div>
  );
}
