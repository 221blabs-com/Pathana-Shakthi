// A chapter's book activities (src/data/bookActivities.ts) as a printable
// worksheet, with the book's own pictures; teachers can add the answers.
import { ActivitySide, BookActivities, KIND_LABEL } from '../data/bookActivities';
import { PublishedReadingImage } from '../types';
import { printDocument } from './printWorkbook';

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const side = (s: ActivitySide, pictures: Record<string, PublishedReadingImage>) => {
  const pic = s.pictureId ? pictures[s.pictureId] : undefined;
  return `${pic ? `<img src="data:${esc(pic.mimeType)};base64,${pic.base64}" style="height:22mm;vertical-align:middle" alt="">` : s.emoji ? `<span style="font-size:24px">${esc(s.emoji)}</span>` : ''} ${esc(s.text || '')}`;
};

export function bookActivitiesHtml(
  chapterTitle: string,
  data: BookActivities,
  pictures: Record<string, PublishedReadingImage> = {},
  opts: { withAnswers?: boolean } = {}
): string {
  const shuffled = <T,>(items: T[]) => [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const sections = data.activities
    .map((a, n) => {
      const head = `<h2>${n + 1}. ${esc(a.instruction)} <span class="meta">${KIND_LABEL[a.kind].label}${a.page ? ` · book p. ${a.page}` : ''}</span></h2>`;
      let body = '';
      if (a.kind === 'match' && a.pairs) {
        const rights = shuffled(a.pairs.map((p) => p.right));
        body = `<table>${a.pairs
          .map((p, i) => `<tr><td>${side(p.left, pictures)}</td><td style="width:30mm;text-align:center">•&nbsp;&nbsp;&nbsp;•</td><td>${side(rights[i], pictures)}</td></tr>`)
          .join('')}</table>${opts.withAnswers ? `<p class="answer">${a.pairs.map((p) => `${esc(p.left.text || '🖼️')} → ${esc(p.right.text || '🖼️')}`).join('; ')}</p>` : ''}`;
      } else if (a.kind === 'order' && a.sequence) {
        body = `<ul>${shuffled(a.sequence).map((s) => `<li>( &nbsp; ) ${esc(s)}</li>`).join('')}</ul>${opts.withAnswers ? `<p class="answer">${a.sequence.map(esc).join(' → ')}</p>` : ''}`;
      } else if (a.items) {
        body = `<ol>${a.items
          .map((it) => {
            const pic = it.pictureId ? pictures[it.pictureId] : undefined;
            const picture = pic ? `<img class="pic" src="data:${esc(pic.mimeType)};base64,${pic.base64}" alt="">` : it.emoji ? `<div style="font-size:40px">${esc(it.emoji)}</div>` : '';
            const prompt = esc(it.prompt).replace('_____', '<span class="blank"></span>');
            const opts2 = a.kind === 'truefalse' ? ' &nbsp; ( True / False )' : it.options?.length ? `<br><span class="opts">( ${it.options.map(esc).join(' / ')} )</span>` : '';
            const lines = a.kind === 'picture' ? '<div class="line"></div><div class="line"></div>' : '';
            const ans = opts.withAnswers && it.answer ? `<div class="answer">${esc(it.answer)}</div>` : '';
            return `<li>${picture}${prompt}${opts2}${lines}${ans}</li>`;
          })
          .join('')}</ol>`;
      } else if (a.lines) {
        body = `<ol>${a.lines.map((l) => `<li>${esc(l)}${a.kind === 'write' ? '<div class="line"></div><div class="line"></div>' : ''}</li>`).join('')}</ol>`;
      }
      return `<section style="break-inside:avoid">${head}${body}</section>`;
    })
    .join('');
  return printDocument(
    `${chapterTitle} — book activities`,
    `<h1>📗 ${esc(chapterTitle)} — book activities${opts.withAnswers ? ' (answers)' : ''}</h1><p class="name">Name: ______________________ &nbsp; Roll No: ______ &nbsp; Date: __________</p>${sections}`
  );
}
