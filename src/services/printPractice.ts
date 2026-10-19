// A chapter's FLN practice (src/data/practice.ts) as a printed worksheet: the
// same items a child plays in the app, laid out the way SCERT workbooks are
// (circle the word, write the missing letter, write the sentence in order).
// Items the teacher reads aloud ("listen and choose", "first sound") are
// numbered and listed in a box for the teacher at the end.
import type { PracticeItem, PracticeKind, PracticeSet } from '../data/practice';
import { printDocument } from './printWorkbook';

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const HEADINGS: Record<PracticeKind, { icon: string; title: string; task: string }> = {
  picture_word: { icon: '🖼️', title: 'Picture and word', task: 'Look at the picture. Circle its word.' },
  listen_choose: { icon: '👂', title: 'Listen and choose', task: 'Listen to your teacher. Circle the word you hear.' },
  first_sound: { icon: '🔤', title: 'First sound', task: 'Listen to your teacher. Circle the letter the word starts with.' },
  missing_letter: { icon: '🧩', title: 'Missing letter', task: 'Write the missing letter.' },
  word_order: { icon: '🔀', title: 'Words in order', task: 'Write the words in the right order.' },
  word_meaning: { icon: '📖', title: 'Word and meaning', task: 'Circle the meaning of the word.' },
};

const CSS = `<style>.pr-item{margin:6px 0 12px;break-inside:avoid}.pr-pic{font-size:34px;vertical-align:middle;margin-right:10px}
.pr-word{font-size:22px;font-weight:700;letter-spacing:.06em}.pr-opts span{display:inline-block;border:1.5px solid #a8a29e;border-radius:10px;padding:2px 12px;margin:2px 6px 2px 0;font-size:17px}
.pr-opts span.ok{border-color:#047857;color:#047857;font-weight:700}.pr-tiles span{display:inline-block;border:1.5px dashed #a8a29e;padding:2px 10px;margin:2px 4px;font-size:16px}
.pr-teacher{border:2px solid #e7e5e4;border-radius:10px;padding:8px 12px;margin-top:18px;font-size:13px}</style>`;

export function practiceHtml(
  title: string,
  set: PracticeSet,
  opts: { className?: string; withAnswers?: boolean; bodyOnly?: boolean } = {}
): string {
  const options = (item: PracticeItem) =>
    `<div class="pr-opts">${item.options
      .map((o) => `<span class="${opts.withAnswers && o === item.answer ? 'ok' : ''}">${esc(o)}</span>`)
      .join('')}</div>`;
  const toRead: string[] = [];
  let number = 0;
  const sections = (Object.keys(HEADINGS) as PracticeKind[])
    .map((kind) => {
      const items = set.items.filter((i) => i.kind === kind);
      if (!items.length) return '';
      const h = HEADINGS[kind];
      const body = items
        .map((item) => {
          number += 1;
          const pic = item.emoji ? `<span class="pr-pic">${item.emoji}</span>` : '';
          switch (kind) {
            case 'picture_word':
              return `<div class="pr-item">${number}. ${pic}${options(item)}</div>`;
            case 'listen_choose':
            case 'first_sound':
              toRead.push(`${number}. ${esc(item.word)}`);
              return `<div class="pr-item">${number}. ${pic}🔊 ${options(item)}</div>`;
            case 'missing_letter':
              return `<div class="pr-item">${number}. ${pic}<span class="pr-word">${esc(
                opts.withAnswers ? item.display!.replace('_', `[${item.answer}]`) : item.display!
              )}</span> ${options(item)}</div>`;
            case 'word_order':
              return `<div class="pr-item">${number}. <span class="pr-tiles">${item.options.map((w) => `<span>${esc(w)}</span>`).join('')}</span>${
                opts.withAnswers ? `<div class="answer">${esc(item.answer)}</div>` : '<div class="line"></div>'
              }</div>`;
            case 'word_meaning':
              return `<div class="pr-item">${number}. <span class="pr-word">${esc(item.word)}</span>${options(item)}</div>`;
          }
        })
        .join('');
      return `<h2>${h.icon} ${esc(h.title)}</h2><p class="opts">${esc(h.task)}</p>${body}`;
    })
    .join('');
  const teacher = toRead.length
    ? `<div class="pr-teacher"><b>For the teacher — read these words aloud:</b> ${toRead.join(' &nbsp; ')}</div>`
    : '';
  const body = `${CSS}<section class="wb">
<h1>🎯 ${esc(title)}</h1>
<p class="meta">Pathana Shakthi · Practice${opts.className ? ` · ${esc(opts.className)}` : ''}${opts.withAnswers ? ' · with answers' : ''}</p>
<p class="name">Name: ______________________ &nbsp; Roll no: ______ &nbsp; Date: ___________</p>
${sections || '<p>No practice for this chapter.</p>'}
${teacher}
</section>`;
  return opts.bodyOnly ? body : printDocument(`${title} — practice`, body);
}
