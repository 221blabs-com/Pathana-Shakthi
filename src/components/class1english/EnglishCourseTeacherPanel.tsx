import React, { useMemo, useState } from 'react';
import { Printer, Volume2 } from 'lucide-react';
import { CLASS1_ENGLISH_UNITS, LESSON_STEPS, periodPlanFor } from '../../data/class1English';
import { unitFlashcardsHtml, unitPlanHtml, unitWorksheetHtml } from '../../services/class1EnglishPrint';
import { printHtml } from '../../services/printWorkbook';
import { kidSpeech } from '../../services/speechSynthesis';

// Teacher's guide to "My English Book · Class 1": each unit's outcomes and
// content, a 40-minute period plan following the Tholimettu English period,
// and printables (unit plan, worksheet, flashcards). The same units are what
// Class 1 children open from their English subject page.
export const EnglishCourseTeacherPanel: React.FC = () => {
  const [unitId, setUnitId] = useState(CLASS1_ENGLISH_UNITS[0].id);
  const unit = CLASS1_ENGLISH_UNITS.find((u) => u.id === unitId) || CLASS1_ENGLISH_UNITS[0];
  const plan = useMemo(() => periodPlanFor(unit), [unit]);
  const [openPeriod, setOpenPeriod] = useState<number | null>(1);
  const say = (text: string) => void kidSpeech.speakText(text, 'English').catch(() => undefined);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6" id="eng1-teacher-panel">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-stone-900">🔤 Class 1 English — teacher’s guide</h2>
          <p className="text-sm text-stone-500">
            8 units · 26 letter sounds · 24 sight words. Children open the same units from their English page (lesson steps:{' '}
            {LESSON_STEPS.map((s) => s.label).join(' → ')}).
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CLASS1_ENGLISH_UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              setUnitId(u.id);
              setOpenPeriod(1);
            }}
            className={`shrink-0 rounded-2xl px-3 py-2 text-sm font-black ${u.id === unit.id ? 'bg-amber-400 text-stone-900' : 'bg-stone-100 text-stone-600'}`}
          >
            {u.emoji} {u.number}. {u.title}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => printHtml(unitPlanHtml(unit))} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white" id="eng1-print-plan">
          <Printer className="h-4 w-4" /> Unit plan
        </button>
        <button type="button" onClick={() => printHtml(unitWorksheetHtml(unit))} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white" id="eng1-print-worksheet">
          <Printer className="h-4 w-4" /> Worksheet
        </button>
        <button type="button" onClick={() => printHtml(unitFlashcardsHtml(unit))} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white" id="eng1-print-cards">
          <Printer className="h-4 w-4" /> Flashcards
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 text-sm text-stone-700">
          <div>
            <h3 className="font-black text-stone-900">🎯 Learning outcomes — the learner…</h3>
            <ul className="mt-1 list-disc pl-5">
              {unit.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-black text-stone-900">🖼️ Picture talk</h3>
            <p>
              {unit.pictureTalk.scene}: {unit.pictureTalk.items.map((i) => `${i.emoji} ${i.word}`).join(', ')}
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-black text-stone-900">
              👂 Listening text: {unit.story.title}
              <button type="button" onClick={() => say(unit.story.lines.join(' '))} aria-label="Read the story aloud">
                <Volume2 className="h-4 w-4 text-sky-600" />
              </button>
            </h3>
            <p>{unit.story.lines.join(' ')}</p>
          </div>
          <div>
            <h3 className="font-black text-stone-900">🎵 Rhyme: {unit.rhyme.title}</h3>
            <p className="whitespace-pre-line">{unit.rhyme.lines.join('\n')}</p>
            <p className="text-xs italic text-stone-500">{unit.rhyme.action}</p>
          </div>
          <div>
            <h3 className="font-black text-stone-900">🔤 Letter sounds</h3>
            <ul>
              {unit.letters.map((l) => (
                <li key={l.letter}>
                  <b className="text-lg">
                    {l.letter.toUpperCase()}
                    {l.letter}
                  </b>{' '}
                  — {l.sound} · {l.words.map((w) => `${w.emoji} ${w.word}`).join(', ')}
                </li>
              ))}
            </ul>
          </div>
          <p>
            <b className="text-stone-900">🧩 Sight words:</b> {unit.sightWords.join(', ')} · <b className="text-stone-900">🎤 Reading:</b> {unit.readAloud.join(' ')}
          </p>
          <p>
            <b className="text-stone-900">🙋 Class activity:</b> {unit.classActivity}
          </p>
        </div>

        <div>
          <h3 className="font-black text-stone-900">🗓️ Period plan ({plan.length} × 40 min)</h3>
          <div className="mt-2 space-y-2">
            {plan.map((p) => (
              <div key={p.period} className="rounded-2xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => setOpenPeriod(openPeriod === p.period ? null : p.period)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-black text-stone-800"
                >
                  <span>
                    Period {p.period}: {p.focus}
                  </span>
                  <span className="text-stone-400">{openPeriod === p.period ? '−' : '+'}</span>
                </button>
                {openPeriod === p.period && (
                  <ol className="space-y-1.5 border-t border-stone-100 px-3 py-2 text-sm text-stone-700">
                    {p.steps.map((s) => (
                      <li key={s.step}>
                        <b>{s.step}</b> <span className="text-stone-400">({s.minutes} min)</span> — {s.what}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Periods follow the Tholimettu English period (face sheet → listening → reading → post-reading → writing). Stories, rhymes and pictures are Pathana
            Shakthi’s own, written for the unit themes of the SCERT Class 1 book.
          </p>
        </div>
      </div>
    </section>
  );
};
