import React from 'react';
import { BENCHMARKS, PARTNER_ROUTES } from '../../data/benchmarks';

// Landing page: the government benchmarks the product is built to, and how to
// partner — matches the pitch deck and brochure.
export const BenchmarksSection: React.FC = () => (
  <section id="benchmarks" className="px-4 pb-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Built to government benchmarks</span>
      <h2 className="mt-2 text-3xl font-black text-[#13277A] sm:text-4xl">Measured the way the system already measures</h2>

      <div className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1fr_1.5fr_1.5fr] bg-[#13277A] px-5 py-3 text-sm font-black text-white sm:grid">
          <span>Benchmark</span>
          <span>What it asks</span>
          <span>How Pathana Shakthi meets it</span>
        </div>
        {BENCHMARKS.map((b, i) => (
          <div key={b.name} className={`grid gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_1.5fr_1.5fr] sm:gap-4 ${i % 2 ? 'bg-stone-50' : ''}`}>
            <span className="font-black text-[#13277A]">{b.name}</span>
            <span className="text-stone-600">{b.asks}</span>
            <span className="text-stone-800">{b.meets}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">Follows public sources (NIPUN Bharat, Tholimettu, SCERT circulars). Not an official certification.</p>

      <h3 className="mt-12 text-2xl font-black text-[#13277A]">Partner with us</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {PARTNER_ROUTES.map((r) => (
          <div key={r.title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#13277A]/10 text-2xl" aria-hidden>
                {r.icon}
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-600">{r.tag}</span>
            </div>
            <p className="mt-4 text-lg font-black text-stone-900">{r.title}</p>
            <p className="mt-1 text-sm text-stone-600">{r.description}</p>
            <p className="mt-4 text-base font-black text-[#13277A]">{r.price}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-stone-100 px-5 py-3 text-sm font-bold text-[#13277A]">
        Low cost to serve: one upload serves every class using that book, and every AI feature falls back to a no-AI version.
      </p>
    </div>
  </section>
);
