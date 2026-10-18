// A printable worksheet of a chapter's unit workbook: blanks with their word
// options, questions with writing lines, "I can…" boxes, reflection prompts
// and the activity. Printed from a hidden frame so no pop-up is needed.
import { UnitWorkbook } from '../types';

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function workbookHtml(title: string, wb: UnitWorkbook, opts: { className?: string; withAnswers?: boolean; bodyOnly?: boolean } = {}): string {
  const lines = (n: number) => '<div class="line"></div>'.repeat(n);
  const section = (icon: string, name: string, body: string) => (body ? `<h2>${icon} ${esc(name)}</h2>${body}` : '');
  const lesson =
    (wb.lesson.points.length ? `<ul>${wb.lesson.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
    (wb.lesson.words.length
      ? `<p class="words">${wb.lesson.words.map((w) => `<b>${esc(w.word)}</b>${w.meaning ? ` – ${esc(w.meaning)}` : ''}`).join(' · ')}</p>`
      : '');
  const blanks = wb.blanks.length
    ? `<ol>${wb.blanks
        .map(
          (b) =>
            `<li>${esc(b.sentence).replace('_____', '<span class="blank">' + (opts.withAnswers ? esc(b.answer) : '') + '</span>')}<div class="opts">( ${b.options
              .map(esc)
              .join(' / ')} )</div></li>`
        )
        .join('')}</ol>`
    : '';
  const questions = wb.questions.length
    ? `<ol>${wb.questions
        .map(
          (q) =>
            `<li>${esc(q.question)}${opts.withAnswers && q.answer ? `<div class="answer">${esc(q.answer)}</div>` : lines(q.kind === 'short' ? 2 : 3)}</li>`
        )
        .join('')}</ol>`
    : '';
  const outcomes = wb.outcomes.length
    ? `<table>${wb.outcomes.map((o) => `<tr><td>${esc(o)}</td><td class="face">😀</td><td class="face">🙂</td><td class="face">😟</td></tr>`).join('')}</table>`
    : '';
  const reflection = wb.reflection.length ? `<ol>${wb.reflection.map((r) => `<li>${esc(r)}${lines(2)}</li>`).join('')}</ol>` : '';
  const activity = wb.activity.steps.length
    ? `<p><b>${esc(wb.activity.title)}</b></p>${
        wb.activity.materials.length ? `<p>🧺 ${wb.activity.materials.map(esc).join(', ')}</p>` : ''
      }<ol>${wb.activity.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '';
  const body = `<section class="wb">
<h1>📘 ${esc(title)}</h1>
<p class="meta">Pathana Shakthi · Chapter workbook${opts.className ? ` · ${esc(opts.className)}` : ''}</p>
<p class="name">Name: ______________________ &nbsp; Roll no: ______ &nbsp; Date: ___________</p>
${section('📖', 'Lesson', lesson)}
${section('✏️', 'Fill in the blanks', blanks)}
${section('❓', 'Questions and answers', questions)}
${section('🎯', 'I can…', outcomes)}
${section('💭', 'What I learned', reflection)}
${section('🎨', 'Activity', activity)}
</section>`;
  return opts.bodyOnly ? body : printDocument(title, body);
}

const PRINT_CSS = `body{font-family:'Noto Sans','Noto Sans Telugu','Noto Sans Devanagari',sans-serif;color:#1c1917;margin:24px;line-height:1.6;font-size:14px}
h1{font-size:20px;margin:0}h2{font-size:16px;margin:20px 0 6px;border-bottom:2px solid #e7e5e4;padding-bottom:2px}
.meta{color:#57534e;font-size:12px;margin:4px 0 0}.name{margin-top:10px;font-size:13px}
.blank{display:inline-block;min-width:90px;border-bottom:1.5px solid #1c1917;text-align:center;font-weight:700}
.opts{color:#57534e;font-size:12px}.line{border-bottom:1px solid #a8a29e;height:26px}
.answer{color:#047857;font-size:13px}table{border-collapse:collapse;width:100%}td{border:1px solid #d6d3d1;padding:4px 8px}
.face{width:34px;text-align:center}li{margin:4px 0 8px}.words{font-size:13px}
.wb + .wb, .chapter + .chapter{break-before:page;page-break-before:always}
.para{font-size:18px;line-height:1.8;margin:0 0 12px}.pic{max-width:100%;max-height:90mm;display:block;margin:8px auto}.cap{text-align:center;font-size:12px;color:#57534e}
.cover{text-align:center;padding-top:60mm;break-after:page}.cover h1{font-size:30px}
@media print{body{margin:12mm}h2{break-after:avoid}li{break-inside:avoid}}`;

/** A complete printable page around some body HTML (Noto fonts for Telugu/Hindi). */
export function printDocument(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&display=swap" rel="stylesheet">
<style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}

/** A whole book as one printable document (choose "Save as PDF" to download it). */
export function bookHtml(
  bookTitle: string,
  chapters: { title: string; paragraphs: string[]; images?: { base64: string; mimeType: string; caption?: string }[] }[],
  meta = ''
): string {
  const cover = `<section class="cover"><h1>📘 ${esc(bookTitle)}</h1><p class="meta">${esc(meta)}</p><p class="meta">Pathana Shakthi</p>
<ol style="text-align:left;display:inline-block;margin-top:16px">${chapters.map((c) => `<li>${esc(c.title)}</li>`).join('')}</ol></section>`;
  const body = chapters
    .map(
      (c) =>
        `<section class="chapter"><h1>${esc(c.title)}</h1>${c.paragraphs.map((p) => `<p class="para">${esc(p)}</p>`).join('')}${(c.images || [])
          .slice(0, 4)
          .map((im) => `<img class="pic" src="data:${esc(im.mimeType)};base64,${im.base64}" alt="">${im.caption ? `<p class="cap">${esc(im.caption)}</p>` : ''}`)
          .join('')}</section>`
    )
    .join('');
  return printDocument(bookTitle, cover + body);
}

/** Print through a hidden frame (works on phones without a pop-up). */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => frame.remove(), 60_000);
    }
  };
  // Give the fonts a moment so Telugu/Hindi print with the right glyphs.
  window.setTimeout(go, 700);
}
