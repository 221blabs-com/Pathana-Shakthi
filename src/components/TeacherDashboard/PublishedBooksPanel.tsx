import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, HelpCircle, Loader2, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { PublishedBookSummary } from '../../types';
import { backendApi } from '../../services/backendApi';

const GRADES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];

// Everything a teacher has published, with the fixes they need without
// re-uploading: move a book to another class, add the comprehension
// questions the AI could not make at publish time, or delete it.
export const PublishedBooksPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const [books, setBooks] = useState<PublishedBookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await backendApi.readings.myBooks();
      setBooks(response.books || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your published books.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const say = (key: string, text: string) => setMessages((prev) => ({ ...prev, [key]: text }));

  const run = async (key: string, action: () => Promise<string>) => {
    setBusyKey(key);
    say(key, '');
    try {
      say(key, await action());
      await load();
    } catch (err) {
      say(key, err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleMove = (book: PublishedBookSummary, grade: string) =>
    run(book.key, async () => {
      const result = await backendApi.readings.moveBook(book.key, grade);
      return `Moved ${result.updated} chapter${result.updated === 1 ? '' : 's'} to ${grade}.`;
    });

  const handleFillQuizzes = (book: PublishedBookSummary) =>
    run(book.key, async () => {
      const result = await backendApi.readings.fillQuizzes(book.key);
      if (result.stillMissing === 0) {
        return `Added questions to ${result.filled} chapter${result.filled === 1 ? '' : 's'}.`;
      }
      return (
        `Added questions to ${result.filled} of ${result.missing} chapters. ` +
        'The AI is busy or out of free quota right now — try again later.'
      );
    });

  const handleClean = (book: PublishedBookSummary) =>
    run(book.key, async () => {
      const r = await backendApi.readings.cleanBook(book.key);
      const bits = [
        `${r.after} chapters (was ${r.before})`,
        r.removed ? `${r.removed} section/extra pages removed` : '',
        r.reanalysed ? `${r.reanalysed} re-analysed` : '',
        r.parts.length ? `parts: ${r.parts.join(', ')}` : '',
      ].filter(Boolean);
      return `Cleaned up: ${bits.join(' · ')}.`;
    });

  const handleDelete = (book: PublishedBookSummary) => {
    if (!window.confirm(`Delete "${book.bookTitle}" (${book.chapterCount} chapters) for every student? This cannot be undone.`)) {
      return;
    }
    void run(book.key, async () => {
      const result = await backendApi.readings.deleteBook(book.key);
      return `Deleted ${result.deleted} chapter${result.deleted === 1 ? '' : 's'}.`;
    });
  };

  return (
    <section
      id="published-books-panel"
      className="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm"
      aria-labelledby="published-books-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">
        <div>
          <h2 id="published-books-heading" className="flex items-center gap-2 text-lg font-black text-stone-900">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            My published books
          </h2>
          <p className="mt-1 text-xs text-stone-600">
            Change which class sees a book, clean up its text, add missing comprehension questions, or remove it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:border-emerald-400 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="divide-y divide-stone-100">
        {error && <p className="px-5 py-4 text-xs font-bold text-rose-700">{error}</p>}
        {!error && !loading && books.length === 0 && (
          <p className="px-5 py-6 text-center text-xs text-stone-500">
            Nothing published yet. Scan a textbook and use “Publish whole book”.
          </p>
        )}
        {books.map((book) => {
          const busy = busyKey === book.key;
          const mixedGrades = book.grades.length > 1;
          return (
            <div key={book.key} className="published-book-row px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-stone-900 line-clamp-1">{book.bookTitle}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-500">
                  {book.chapterCount} chapter{book.chapterCount === 1 ? '' : 's'} · {book.subjects.join(', ')}
                  {book.missingQuiz > 0 && (
                    <span className="ml-1.5 font-bold text-amber-700">
                      · {book.missingQuiz} without questions
                    </span>
                  )}
                </p>
                {messages[book.key] && (
                  <p className="mt-1 text-[11px] font-bold text-emerald-800" role="status">
                    {messages[book.key]}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                  Class
                  <select
                    className="book-grade-select rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 disabled:opacity-50"
                    value={mixedGrades ? '' : book.grades[0]}
                    disabled={busy}
                    onChange={(e) => e.target.value && void handleMove(book, e.target.value)}
                  >
                    {mixedGrades && <option value="">Mixed</option>}
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleClean(book)}
                  title="Remove page labels, section title pages and notes from the text; add missing analysis"
                  className="btn-clean-book inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Clean up book
                </button>
                {book.missingQuiz > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleFillQuizzes(book)}
                    className="btn-fill-quizzes inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-stone-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
                    Add missing questions
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(book)}
                  title="Delete this book"
                  className="btn-delete-book inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {loading && books.length === 0 && (
          <p className="flex items-center gap-2 px-5 py-4 text-xs font-bold text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your books…
          </p>
        )}
      </div>
    </section>
  );
};
