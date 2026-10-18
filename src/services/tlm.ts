// Printable Teaching-Learning Materials (TLM): cut-out cards and charts a
// teacher prints for the classroom — from a published chapter (word cards,
// reading cards, question cards, the chapter itself as a big-print reader)
// and a foundational kit (number cards and 1-100 chart, maths fact cards,
// clock face, alphabet charts in English, Telugu and Hindi). Every generator
// returns a complete HTML page for printHtml().

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const page = (title: string, body: string, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;900&family=Noto+Sans+Devanagari:wght@400;700;900&family=Noto+Sans+Telugu:wght@400;700;900&display=swap" rel="stylesheet">
<style>
body{font-family:'Noto Sans','Noto Sans Telugu','Noto Sans Devanagari',sans-serif;margin:10mm;color:#1c1917}
h1{font-size:16px;margin:0 0 6px}.meta{font-size:10px;color:#78716c;margin:0 0 8px}
.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:0}
.card{border:1.5px dashed #a8a29e;padding:14px;min-height:62mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;break-inside:avoid}
.big{font-size:40px;font-weight:900;line-height:1.3}.small{font-size:14px;color:#57534e;margin-top:6px}
${extraCss}
@media print{.card{break-inside:avoid}}
</style></head><body><h1>${esc(title)}</h1><p class="meta">Pathana Shakthi · TLM · cut along the dashed lines</p>${body}</body></html>`;

export function wordCardsHtml(title: string, words: { word: string; meaning?: string }[]): string {
  const cards = words
    .filter((w) => w.word)
    .map((w) => `<div class="card"><div class="big">${esc(w.word)}</div>${w.meaning ? `<div class="small">${esc(w.meaning)}</div>` : ''}</div>`)
    .join('');
  return page(`Word cards · ${title}`, `<div class="cards">${cards}</div>`);
}

/** Split a chapter into cards of about `words` words, never mid-sentence when avoidable. */
export function splitIntoCards(paragraphs: string[], words: number): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    const sentences = p.split(/(?<=[.!?।॥])\s+/).filter(Boolean);
    let cur: string[] = [];
    let n = 0;
    for (const s of sentences) {
      const w = s.split(/\s+/).length;
      if (n && n + w > words) {
        out.push(cur.join(' '));
        cur = [];
        n = 0;
      }
      cur.push(s);
      n += w;
    }
    if (cur.length) out.push(cur.join(' '));
  }
  return out;
}

export function readingCardsHtml(title: string, paragraphs: string[], wordsPerCard = 25): string {
  const cards = splitIntoCards(paragraphs, wordsPerCard)
    .map((t, i) => `<div class="card"><div style="font-size:22px;font-weight:700;line-height:1.6">${esc(t)}</div><div class="small">${i + 1}</div></div>`)
    .join('');
  return page(`Reading cards · ${title}`, `<div class="cards">${cards}</div>`);
}

export function chapterReaderHtml(title: string, paragraphs: string[], meta = ''): string {
  return page(
    title,
    `${meta ? `<p class="meta">${esc(meta)}</p>` : ''}${paragraphs.map((p) => `<p class="para">${esc(p)}</p>`).join('')}`,
    '.para{font-size:20px;line-height:1.8;margin:0 0 14px}'
  );
}

export function questionCardsHtml(title: string, questions: { question: string; options?: string[] }[]): string {
  const cards = questions
    .map(
      (q, i) =>
        `<div class="card"><div style="font-size:20px;font-weight:700">${i + 1}. ${esc(q.question)}</div>${
          q.options?.length ? `<div class="small" style="font-size:16px">${q.options.map((o, j) => `${String.fromCharCode(65 + j)}) ${esc(o)}`).join(' &nbsp; ')}</div>` : ''
        }</div>`
    )
    .join('');
  return page(`Question cards · ${title}`, `<div class="cards">${cards}</div>`);
}

export function numberCardsHtml(from: number, to: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const cards = Array.from({ length: to - from + 1 }, (_, i) => from + i)
    .map((n) => `<div class="card"><div class="big" style="font-size:64px">${n}</div><div class="small">${'●'.repeat(Math.min(n, 20))}</div>${words[n] ? `<div class="small">${words[n]}</div>` : ''}</div>`)
    .join('');
  return page(`Number cards ${from}-${to}`, `<div class="cards" style="grid-template-columns:repeat(3,1fr)">${cards}</div>`);
}

export function hundredChartHtml(): string {
  const rows = Array.from({ length: 10 }, (_, r) => `<tr>${Array.from({ length: 10 }, (_, c) => `<td>${r * 10 + c + 1}</td>`).join('')}</tr>`).join('');
  return page('1 to 100 chart', `<table class="chart">${rows}</table>`, '.chart{border-collapse:collapse;width:100%}.chart td{border:1.5px solid #44403c;text-align:center;font-size:22px;font-weight:700;height:16mm}.chart tr:nth-child(odd) td:nth-child(10){background:#fef3c7}');
}

/** Maths fact cards (question on the card, answer small underneath for self-check). */
export function factCards(op: '+' | '-' | '×', limit: number, count: number, random: () => number = Math.random): { q: string; a: number }[] {
  const seen = new Set<string>();
  const out: { q: string; a: number }[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 50) {
    let a = 0;
    let b = 0;
    if (op === '×') {
      a = 1 + Math.floor(random() * Math.min(10, limit));
      b = 1 + Math.floor(random() * 10);
    } else {
      a = Math.floor(random() * (limit + 1));
      b = Math.floor(random() * (limit + 1));
      if (op === '+' && a + b > limit) continue;
      if (op === '-' && b > a) [a, b] = [b, a];
    }
    const q = `${a} ${op} ${b}`;
    if (seen.has(q)) continue;
    seen.add(q);
    out.push({ q, a: op === '+' ? a + b : op === '-' ? a - b : a * b });
  }
  return out;
}

export function factCardsHtml(op: '+' | '-' | '×', limit: number, count = 24): string {
  const name = op === '+' ? 'Addition' : op === '-' ? 'Subtraction' : 'Multiplication';
  const cards = factCards(op, limit, count)
    .map((f) => `<div class="card"><div class="big">${esc(f.q)} = ?</div><div class="small" style="transform:rotate(180deg);font-size:12px">${f.a}</div></div>`)
    .join('');
  return page(`${name} cards (up to ${limit})`, `<div class="cards" style="grid-template-columns:repeat(3,1fr)">${cards}</div>`);
}

export function clockFaceHtml(): string {
  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const a = (n * 30 - 90) * (Math.PI / 180);
    return `<text x="${100 + 78 * Math.cos(a)}" y="${100 + 78 * Math.sin(a) + 7}" text-anchor="middle" font-size="20" font-weight="700">${n}</text>`;
  }).join('');
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6) * (Math.PI / 180);
    const r1 = i % 5 === 0 ? 88 : 92;
    return `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + 96 * Math.cos(a)}" y2="${100 + 96 * Math.sin(a)}" stroke="#1c1917" stroke-width="${i % 5 === 0 ? 2 : 1}"/>`;
  }).join('');
  const clock = `<svg viewBox="0 0 200 200" width="170mm" height="170mm"><circle cx="100" cy="100" r="97" fill="none" stroke="#1c1917" stroke-width="3"/>${ticks}${nums}<circle cx="100" cy="100" r="4"/></svg>`;
  const hands = `<svg viewBox="0 0 200 40" width="170mm"><rect x="10" y="5" width="70" height="10" rx="5" fill="none" stroke="#1c1917" stroke-width="2"/><text x="45" y="32" text-anchor="middle" font-size="9">hour hand</text><rect x="100" y="5" width="90" height="7" rx="3.5" fill="none" stroke="#1c1917" stroke-width="2"/><text x="145" y="32" text-anchor="middle" font-size="9">minute hand</text></svg>`;
  return page('Clock face (cut out, pin the hands in the middle)', `<div style="text-align:center">${clock}${hands}</div>`);
}

export const ALPHABETS: Record<string, { title: string; groups: { name: string; letters: string[] }[] }> = {
  English: {
    title: 'English alphabet',
    groups: [
      { name: 'Capital letters', letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
      { name: 'Small letters', letters: 'abcdefghijklmnopqrstuvwxyz'.split('') },
    ],
  },
  Telugu: {
    title: 'తెలుగు అక్షరమాల',
    groups: [
      { name: 'అచ్చులు (vowels)', letters: ['అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఋ', 'ౠ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ', 'ఔ', 'అం', 'అః'] },
      {
        name: 'హల్లులు (consonants)',
        letters: ['క', 'ఖ', 'గ', 'ఘ', 'ఙ', 'చ', 'ఛ', 'జ', 'ఝ', 'ఞ', 'ట', 'ఠ', 'డ', 'ఢ', 'ణ', 'త', 'థ', 'ద', 'ధ', 'న', 'ప', 'ఫ', 'బ', 'భ', 'మ', 'య', 'ర', 'ల', 'వ', 'శ', 'ష', 'స', 'హ', 'ళ', 'క్ష', 'ఱ'],
      },
    ],
  },
  Hindi: {
    title: 'हिंदी वर्णमाला',
    groups: [
      { name: 'स्वर (vowels)', letters: ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः'] },
      {
        name: 'व्यंजन (consonants)',
        letters: ['क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'क्ष', 'त्र', 'ज्ञ'],
      },
    ],
  },
};

export function alphabetChartHtml(language: keyof typeof ALPHABETS): string {
  const a = ALPHABETS[language];
  const body = a.groups
    .map(
      (g) =>
        `<h2 style="font-size:14px;margin:10px 0 4px">${esc(g.name)}</h2><div class="grid">${g.letters.map((l) => `<div class="cell">${esc(l)}</div>`).join('')}</div>`
    )
    .join('');
  return page(a.title, body, '.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:0}.cell{border:1.5px solid #44403c;text-align:center;font-size:40px;font-weight:900;padding:8px 0}');
}
