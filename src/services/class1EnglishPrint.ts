// Printables for "My English Book · Class 1" (src/data/class1English.ts): a
// unit worksheet, cut-out flashcards and the teacher's period plan. Each
// returns a complete HTML page for printHtml().
import {
  EnglishUnit,
  beginningSoundRounds,
  missingLetterRounds,
  periodPlanFor,
  sightWordsUpTo,
} from '../data/class1English';

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=Noto+Sans:wght@400;700;900&display=swap" rel="stylesheet">
<style>
body{font-family:'Andika','Noto Sans',sans-serif;margin:10mm;color:#1c1917}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:14px 0 6px;border-bottom:2px solid #f59e0b;padding-bottom:2px}
.meta{font-size:11px;color:#78716c;margin:2px 0 8px}.name{font-size:13px;margin:6px 0 4px}
.trace{display:flex;align-items:flex-end;gap:10px;font-size:54px;line-height:1;margin:4px 0}
.ghost{color:#d6d3d1}.key{color:#1c1917;font-weight:700}.lines{flex:1;border-bottom:2px solid #78716c;height:46px;background:repeating-linear-gradient(transparent 0 22px,#e7e5e4 22px 23px)}
.row{display:flex;align-items:center;gap:16px;margin:6px 0;font-size:15px}.pic{font-size:40px;border:1.5px solid #d6d3d1;border-radius:12px;padding:4px 10px;min-width:56px;text-align:center}
.miss{font-size:28px;letter-spacing:3px;font-weight:700}.opts{font-size:12px;color:#78716c}
.match{display:grid;grid-template-columns:1fr 60px 1fr;row-gap:8px;align-items:center}.dot{text-align:center;color:#a8a29e}
.wordgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.wordgrid div{border:1.5px solid #d6d3d1;border-radius:10px;text-align:center;padding:8px 0;font-size:20px}
.box{border:2px dashed #a8a29e;height:70mm;border-radius:12px;margin-top:4px}
.cards{display:grid;grid-template-columns:repeat(3,1fr)}.card{border:1.5px dashed #a8a29e;min-height:58mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-inside:avoid}
.card .big{font-size:56px;font-weight:700;line-height:1.1}.card .em{font-size:44px}.card .small{font-size:16px;margin-top:4px}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #d6d3d1;padding:4px 6px;vertical-align:top;text-align:left}th{background:#fef3c7}
.section{break-inside:avoid}
@media print{body{margin:10mm}.section{break-inside:avoid}}
</style></head><body>${body}</body></html>`;

const header = (unit: EnglishUnit, what: string) =>
  `<h1>Unit ${unit.number}: ${esc(unit.title)} — ${esc(what)}</h1><p class="meta">My English Book · Class 1 · Theme: ${esc(unit.theme)} · Pathana Shakthi</p>`;

/** The child's worksheet for a unit (trace, sounds, missing letter, match, sight words, draw and write). */
export function unitWorksheetHtml(unit: EnglishUnit, random: () => number = Math.random): string {
  const trace = unit.letters
    .map(
      (l) =>
        `<div class="trace"><span class="key">${esc(l.letter.toUpperCase())}${esc(l.letter)}</span><span class="ghost">${esc(
          `${l.letter.toUpperCase()}${l.letter} `.repeat(3)
        )}</span><span class="lines"></span></div>`
    )
    .join('');
  const sounds = beginningSoundRounds(unit, random)
    .filter((_, i) => i % 2 === 0)
    .map(
      (r) =>
        `<div class="row"><span style="min-width:150px">${esc(r.prompt.replace('Which picture', 'Circle the picture that').replace(/\?$/, '.'))}</span>${r.options
          .map((o) => `<span class="pic">${o.emoji}</span>`)
          .join('')}</div>`
    )
    .join('');
  const missing = missingLetterRounds(unit, random)
    .map((r) => `<div class="row"><span class="pic">${r.word.emoji}</span><span class="miss">${esc(r.masked)}</span><span class="opts">( ${r.options.map(esc).join(' / ')} )</span></div>`)
    .join('');
  const pairs = unit.pictureTalk.items.slice(0, 5);
  const words = [...pairs].sort(() => random() - 0.5);
  const match = `<div class="match">${pairs
    .map((p, i) => `<div class="pic" style="justify-self:start">${p.emoji}</div><div class="dot">•&nbsp;&nbsp;&nbsp;•</div><div style="font-size:20px">${esc(words[i].word)}</div>`)
    .join('')}</div>`;
  const target = unit.sightWords;
  const grid = [...target, ...target, ...sightWordsUpTo(unit.number).filter((w) => !target.includes(w)).slice(-6), ...target]
    .slice(0, 12)
    .sort(() => random() - 0.5);
  const body = `${header(unit, 'Worksheet')}
<p class="name">Name: ______________________ &nbsp; Roll No: ______ &nbsp; Date: __________</p>
<div class="section"><h2>1. Trace and write</h2>${trace}</div>
<div class="section"><h2>2. Listen to the sound. Circle the right picture.</h2>${sounds}</div>
<div class="section"><h2>3. Fill in the missing letter.</h2>${missing}</div>
<div class="section"><h2>4. Match the picture with the word.</h2>${match}</div>
<div class="section"><h2>5. Colour every “${target.map(esc).join('”, “')}”.</h2><div class="wordgrid">${grid.map((w) => `<div>${esc(w)}</div>`).join('')}</div></div>
<div class="section"><h2>6. Draw and write.</h2><p style="font-size:16px">${esc(unit.draw.prompt)}</p><div class="box"></div>
<p style="font-size:22px;margin-top:8px">${esc(unit.draw.starter)} ________________________.</p></div>`;
  return page(`Unit ${unit.number} worksheet`, body);
}

/** Cut-out flashcards: letter cards, picture-word cards, sight-word cards. */
export function unitFlashcardsHtml(unit: EnglishUnit): string {
  const letterCards = unit.letters.map(
    (l) => `<div class="card"><div class="big">${esc(l.letter.toUpperCase())} ${esc(l.letter)}</div><div class="em">${l.words[0].emoji}</div><div class="small">${esc(l.words[0].word)}</div></div>`
  );
  // Each word once (a picture-talk word can also be a letter's key word).
  const seen = new Set(unit.letters.map((l) => l.words[0].word));
  const pictures = [...unit.letters.flatMap((l) => l.words.slice(1)), ...unit.pictureTalk.items].filter((w) => !seen.has(w.word) && seen.add(w.word));
  const pictureCards = pictures.map(
    (w) => `<div class="card"><div class="em">${w.emoji}</div><div class="small" style="font-size:24px;font-weight:700">${esc(w.word)}</div></div>`
  );
  const sightCards = unit.sightWords.map((w) => `<div class="card"><div class="big">${esc(w)}</div><div class="small">sight word</div></div>`);
  return page(`Unit ${unit.number} flashcards`, `${header(unit, 'Flashcards')}<p class="meta">Cut along the dashed lines.</p><div class="cards">${[...letterCards, ...pictureCards, ...sightCards].join('')}</div>`);
}

/** The teacher's unit plan: outcomes, materials, and every period step by step. */
export function unitPlanHtml(unit: EnglishUnit): string {
  const plan = periodPlanFor(unit);
  const rows = plan
    .map(
      (p) =>
        `<tr><td><b>${p.period}</b></td><td><b>${esc(p.focus)}</b></td><td>${p.steps
          .map((s) => `<div><b>${esc(s.step)}</b> (${s.minutes} min): ${esc(s.what)}</div>`)
          .join('')}</td></tr>`
    )
    .join('');
  const body = `${header(unit, 'Unit plan')}
<h2>Learning outcomes — the learner…</h2><ul>${unit.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
<h2>Content</h2>
<p><b>Picture talk:</b> ${esc(unit.pictureTalk.scene)} — ${unit.pictureTalk.items.map((i) => esc(i.word)).join(', ')}</p>
<p><b>Listening text:</b> ${esc(unit.story.title)} — “${unit.story.lines.map(esc).join(' ')}”</p>
<p><b>Rhyme:</b> ${esc(unit.rhyme.title)} — ${unit.rhyme.lines.map(esc).join(' / ')} <i>(${esc(unit.rhyme.action)})</i></p>
<p><b>Letter sounds:</b> ${unit.letters.map((l) => `${esc(l.letter)} (${esc(l.sound)})`).join('; ')}</p>
<p><b>Sight words:</b> ${unit.sightWords.map(esc).join(', ')}</p>
<p><b>Reading lines:</b> ${unit.readAloud.map(esc).join(' ')}</p>
<h2>Period plan (${plan.length} periods × 40 minutes)</h2>
<table><tr><th>#</th><th>Focus</th><th>Steps</th></tr>${rows}</table>
<h2>Materials</h2><p>Picture chart or projector (app), flashcards (print from the app), slates or notebooks, the unit worksheet.</p>
<p class="meta">Period steps follow the Tholimettu English period: face sheet → listening → reading (model, collaborative, individual) → post-reading → writing. Content is Pathana Shakthi’s own; check it against the SCERT Class 1 book.</p>`;
  return page(`Unit ${unit.number} plan`, body);
}
