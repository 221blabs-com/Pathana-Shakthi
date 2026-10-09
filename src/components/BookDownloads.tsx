import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatBytes, offlineBooks, SavedBook } from '../services/offlineBooks';

// Download row under a book: keep the whole book on this phone for reading
// without internet, or print it (Print → Save as PDF). Shown to children on
// the subject page and reused on the teacher's materials tab.
export const BookDownloads: React.FC<{
  bookKey: string;
  title: string;
  chapterIds: string[];
  meta?: string;
  compact?: boolean;
}> = ({ bookKey, title, chapterIds, meta = '', compact }) => {
  const [saved, setSaved] = useState<SavedBook | null>(() => offlineBooks.get(bookKey));
  const [busy, setBusy] = useState<'' | 'save' | 'pdf' | 'remove'>('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // A saved book that has new chapters since it was saved.
  const outdated = Boolean(saved && chapterIds.some((id) => !saved.chapterIds.includes(id)));

  const run = async (kind: 'save' | 'pdf' | 'remove', job: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setProgress('');
    try {
      await job();
    } catch (err) {
      setError(
        navigator.onLine === false
          ? 'You are offline — connect to the internet to download.'
          : err instanceof Error
            ? err.message
            : 'Could not download this book.'
      );
    } finally {
      setBusy('');
      setProgress('');
    }
  };

  const save = () =>
    run('save', async () => {
      const book = await offlineBooks.save(bookKey, title, chapterIds, (done, total) => setProgress(`Saving ${done}/${total}…`));
      setSaved(book);
    });
  const pdf = () =>
    run('pdf', () => offlineBooks.printBook(title, chapterIds, meta, (done, total) => setProgress(`Preparing ${done}/${total}…`)));
  const remove = () =>
    run('remove', async () => {
      await offlineBooks.remove(bookKey);
      setSaved(null);
    });

  const btn =
    'inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-black disabled:opacity-60';
  return (
    <div className={`book-downloads flex flex-wrap items-center gap-2 ${compact ? '' : 'border-t border-stone-100 px-4 py-2 bg-stone-50/60'}`}>
      {saved && !outdated ? (
        <span className="book-saved inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-800">
          ✅ On this device · {formatBytes(saved.bytes)}
        </span>
      ) : (
        <button type="button" className={`btn-save-offline ${btn} border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400`} disabled={Boolean(busy)} onClick={save}>
          {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '⬇️'} {outdated ? 'Update offline copy' : 'Save offline'}
        </button>
      )}
      <button type="button" className={`btn-book-pdf ${btn} border-stone-200 bg-white text-stone-700 hover:border-sky-300`} disabled={Boolean(busy)} onClick={pdf}>
        {busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '📄'} Book PDF
      </button>
      {saved && (
        <button type="button" className={`btn-remove-offline ${btn} border-transparent text-stone-500 hover:text-rose-700`} disabled={Boolean(busy)} onClick={remove}>
          Remove from device
        </button>
      )}
      {progress && <span className="text-[11px] font-bold text-stone-500">{progress}</span>}
      {error && <span className="text-[11px] font-bold text-rose-700">{error}</span>}
    </div>
  );
};
