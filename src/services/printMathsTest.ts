import type { MathsTest } from '../data/mathsTest';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A maths chapter's test as a printable worksheet (options to tick), or the answer key with worked answers. */
export function mathsTestHtml(title: string, test: MathsTest, opts: { answers?: boolean; className?: string } = {}): string {
  const items = test.questions
    .map(
      (q, i) => `<li><p class="q">${esc(q.prompt)}</p>${
        opts.answers
          ? `<p class="a">✔ ${esc(q.answer)}</p><p class="how">${esc(q.explain)}</p>`
          : `<p class="opts">${q.options.map((o) => `<span>◯ ${esc(o)}</span>`).join('')}</p>`
      }</li>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:'Noto Sans','Noto Sans Telugu','Noto Sans Devanagari',sans-serif;margin:24px;color:#1f2937}
h1{font-size:20px;margin:0}.meta{font-size:12px;color:#555;margin:4px 0 14px}.name{border-bottom:1px solid #999;display:inline-block;width:220px}
ol{padding-left:22px}li{margin:0 0 14px;break-inside:avoid}.q{font-size:16px;font-weight:700;margin:0 0 6px}
.opts span{display:inline-block;margin-right:22px;font-size:15px}.a{margin:0;font-weight:700;color:#047857}.how{margin:2px 0 0;font-size:13px;color:#444}
</style></head><body>
<h1>${opts.answers ? 'Answer key · ' : ''}${esc(title)}</h1>
<p class="meta">${opts.className ? `${esc(opts.className)} · ` : ''}${opts.answers ? '' : 'Name: <span class="name"></span> &nbsp; Roll no.: <span class="name" style="width:80px"></span>'}</p>
<ol>${items}</ol></body></html>`;
}
