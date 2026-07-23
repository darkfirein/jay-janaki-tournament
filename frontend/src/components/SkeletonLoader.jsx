import React from 'react';

// Base shimmer block — every skeleton below is built from this.
function Bar({ className = '' }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

/**
 * Generic "list of similar cards" skeleton — a row of pulsing bars per item.
 * Used by any page whose real content is a list: My Bookings, Results,
 * Leaderboard, and the admin Bookings/Withdrawals/Users/Tournaments pages.
 */
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-3">
            <Bar className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3 w-1/3" />
              <Bar className="h-3 w-1/2" />
            </div>
            <Bar className="h-6 w-16 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Three stat cards + one chart-shaped block — used by admin Dashboard and
 * (twice, stacked) by Analytics.
 */
export function StatsSkeleton() {
  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <Bar className="h-3 w-1/2" />
            <Bar className="h-7 w-2/3" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <Bar className="h-4 w-1/4 mb-5" />
        <Bar className="h-52 w-full !bg-white/5" />
      </div>
    </div>
  );
}

/** Profile page — avatar row, a stat grid, then two form-shaped card blocks. */
export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Bar className="w-16 h-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Bar className="h-5 w-1/3" />
          <Bar className="h-3 w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-3 space-y-2">
            <Bar className="h-5 w-1/2 mx-auto" />
            <Bar className="h-2 w-3/4 mx-auto" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card p-6 space-y-4 mb-6">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-9 w-full" />
          <Bar className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Tournament detail page — banner, title block, countdown row, then a form block. */
export function TournamentDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <Bar className="w-full h-48 sm:h-64 !rounded-xl mb-5" />
      <Bar className="h-3 w-1/4 mb-2" />
      <Bar className="h-8 w-2/3 mb-6" />
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-16 !rounded-lg" />
        ))}
      </div>
      <div className="card p-6 space-y-4">
        <Bar className="h-5 w-1/3" />
        <Bar className="h-9 w-full" />
        <Bar className="h-9 w-full" />
        <Bar className="h-10 w-full" />
      </div>
    </div>
  );
}

/** Home page — hero text, countdown card, filter bar, tournament cards, sidebar. */
export default function HomeSkeleton() {
  return (
    <div>
      <section className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 text-center">
          <Bar className="h-6 w-48 mx-auto mb-6 !rounded-full" />
          <Bar className="h-10 w-3/4 max-w-md mx-auto mb-4" />
          <Bar className="h-4 w-2/3 max-w-sm mx-auto mb-8" />
          <div className="max-w-md mx-auto card p-5">
            <Bar className="h-3 w-1/2 mx-auto mb-3" />
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Bar key={i} className="h-14 !rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 pb-14 grid md:grid-cols-3 gap-8">
        <section className="md:col-span-2 space-y-4">
          <Bar className="h-3 w-32 mb-1" />
          <Bar className="h-14 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Bar className="w-full h-36 !rounded-none" />
              <div className="p-5 space-y-3">
                <Bar className="h-3 w-1/4" />
                <Bar className="h-5 w-2/3" />
                <Bar className="h-3 w-full" />
              </div>
            </div>
          ))}
        </section>
        <aside className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} className="h-16" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
