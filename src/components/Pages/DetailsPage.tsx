import React from 'react';
import { ArrowLeft, Download, FileText, Presentation, Film } from 'lucide-react';
import { AppViewRoute } from '../../types';
import { BENCHMARKS, PARTNER_ROUTES } from '../../data/benchmarks';

// Public "Details" page (navbar button beside Login, URL /details): what
// Pathana Shakthi is, the government benchmarks it is built to, how to partner,
// and the pitch deck / brochure / film to download (files in public/downloads).
// Prices are only in the downloadable documents, never on the site.

const DOWNLOADS = [
  { icon: Presentation, title: 'Pitch deck', note: 'PowerPoint, editable', href: '/downloads/Pathana-Shakthi-Pitch-Deck.pptx' },
  { icon: FileText, title: 'Pitch deck', note: 'PDF', href: '/downloads/Pathana-Shakthi-Pitch-Deck.pdf' },
  { icon: FileText, title: 'Brochure', note: 'PDF, 8 pages', href: '/downloads/Pathana-Shakthi-Brochure.pdf' },
  { icon: Film, title: 'Product film', note: 'MP4, 86 seconds', href: '/downloads/Pathana-Shakthi-Film.mp4' },
];

const FEATURES = [
  ['📖', 'Read-along that listens', 'An Indian voice reads first; the child reads aloud and every word is checked.'],
  ['🧮', 'Maths tests with worked answers', 'The chapter’s own sums first, then new ones of the same size, step by step.'],
  ['📝', 'SCERT-pattern workbook', 'Comprehension, vocabulary, grammar and writing for every chapter.'],
  ['🧪', 'FLN reading check', 'Timed oral reading scored against NIPUN Bharat norms.'],
  ['🧑‍🏫', 'Teacher dashboard', 'Need Help · Go Ahead · Very Good, registers, assessment rounds and an AI agent.'],
  ['🏫', 'Headmaster roll-up', 'Attendance, FLN rounds and curriculum pace for every class.'],
];

export const DetailsPage: React.FC<{ onNavigate: (route: AppViewRoute) => void }> = ({ onNavigate }) => (
  <div className="min-h-screen bg-[#f7f5ef] px-4 pb-24 pt-28 sm:px-6 lg:px-8" id="details-page">
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => onNavigate('landing')}
        className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 hover:border-stone-500"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </button>

      <header className="mt-6">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">Pathana Shakthi · 221B Labs</span>
        <h1 className="mt-2 text-4xl font-black text-[#13277A] sm:text-5xl">The AI co-teacher for India’s classrooms</h1>
        <p className="mt-3 max-w-3xl text-lg text-stone-600">
          It listens to every child read, turns the state textbook into a whole course, and shows the teacher where to help —
          in Telugu, Hindi and English, for Classes 1–10, built to NIPUN Bharat, NEP 2020 and SCERT benchmarks.
        </p>
      </header>

      {/* Downloads */}
      <section className="mt-10" aria-labelledby="downloads-title">
        <h2 id="downloads-title" className="text-2xl font-black text-[#13277A]">Downloads</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOWNLOADS.map((d) => (
            <a
              key={d.href}
              href={d.href}
              download
              className="details-download group flex items-center gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#13277A]/40 hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#13277A] text-white">
                <d.icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-stone-900">{d.title}</span>
                <span className="block text-sm text-stone-500">{d.note}</span>
              </span>
              <Download className="h-5 w-5 text-stone-400 group-hover:text-[#13277A]" />
            </a>
          ))}
        </div>
        <video className="mt-6 w-full rounded-3xl border border-stone-200 bg-black shadow-sm" controls preload="none" poster="/downloads/film-poster.jpg">
          <source src="/downloads/Pathana-Shakthi-Film.mp4" type="video/mp4" />
        </video>
      </section>

      {/* What it does */}
      <section className="mt-14" aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-black text-[#13277A]">What it does</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, title, text]) => (
            <div key={title} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-3xl" aria-hidden>
                {icon}
              </span>
              <p className="mt-3 font-black text-stone-900">{title}</p>
              <p className="mt-1 text-sm text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benchmarks */}
      <section className="mt-14" aria-labelledby="benchmarks-title">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">Built to government benchmarks</span>
        <h2 id="benchmarks-title" className="mt-1 text-2xl font-black text-[#13277A]">Measured the way the system already measures</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
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
      </section>

      {/* Partnering */}
      <section className="mt-14" aria-labelledby="partner-title">
        <h2 id="partner-title" className="text-2xl font-black text-[#13277A]">Partner with us</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="mt-14 rounded-3xl bg-[#13277A] p-8 text-white" aria-labelledby="contact-title">
        <h2 id="contact-title" className="text-2xl font-black">Let’s get every child reading</h2>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <a href="mailto:admin@221blabs.com" className="hover:underline">✉️ admin@221blabs.com</a>
          <a href="https://www.221blabs.com/" target="_blank" rel="noreferrer" className="hover:underline">🌐 www.221blabs.com</a>
          <a href="tel:+918639813168" className="hover:underline">📞 8639813168</a>
          <span>📍 7th Block, Malla Reddy University, Maisammaguda, Hyderabad, Telangana 500100</span>
        </div>
      </section>
    </div>
  </div>
);
