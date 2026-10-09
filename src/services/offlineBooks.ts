// Downloads: "⬇️ Save offline" keeps a whole book on this device (every
// chapter's text, pictures, workbook and animated lesson, in Cache Storage via
// offlineCache) so it opens without internet; "📄 Book PDF" and "📝 Workbooks
// PDF" make one printable document (Print → Save as PDF).
import { backendApi } from './backendApi';
import { deleteOffline, putOffline } from './offlineCache';
import { bookHtml, printDocument, printHtml, workbookHtml } from './printWorkbook';

export interface SavedBook {
  title: string;
  chapterIds: string[];
  savedAt: string;
  bytes: number;
}

const LIST_KEY = 'ps_offline_books';
const readList = (): Record<string, SavedBook> => {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
const writeList = (all: Record<string, SavedBook>) => {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(all));
  } catch {
    // storage full
  }
};

export const offlineBooks = {
  list: readList,
  get: (bookKey: string): SavedBook | null => readList()[bookKey] || null,

  /** Save every chapter of a book for reading without internet. */
  async save(bookKey: string, title: string, chapterIds: string[], onProgress?: (done: number, total: number) => void): Promise<SavedBook> {
    let bytes = 0;
    let done = 0;
    for (const id of chapterIds) {
      const [reading, images, workbook, explainer] = await Promise.all([
        backendApi.readings.get(id),
        backendApi.readings.images(id).catch(() => ({ success: true, images: [] })),
        backendApi.readings.workbook(id, true).catch(() => null),
        backendApi.readings.explainer(id, true).catch(() => null),
      ]);
      bytes += await putOffline(`reading/${id}`, reading);
      bytes += await putOffline(`images/${id}`, images);
      if (workbook) bytes += await putOffline(`workbook/${id}`, workbook);
      if (explainer) bytes += await putOffline(`explainer/${id}`, { ...explainer, pending: false });
      onProgress?.(++done, chapterIds.length);
    }
    const saved = { title, chapterIds, savedAt: new Date().toISOString(), bytes };
    writeList({ ...readList(), [bookKey]: saved });
    return saved;
  },

  async remove(bookKey: string) {
    const all = readList();
    const book = all[bookKey];
    if (book) await deleteOffline(book.chapterIds.flatMap((id) => [`reading/${id}`, `images/${id}`, `workbook/${id}`, `explainer/${id}`]));
    delete all[bookKey];
    writeList(all);
  },

  /** The whole book as one printable document with its pictures. */
  async printBook(title: string, chapterIds: string[], meta = '', onProgress?: (done: number, total: number) => void) {
    const chapters = [];
    let done = 0;
    for (const id of chapterIds) {
      const [{ reading }, images] = await Promise.all([backendApi.readings.get(id), backendApi.readings.images(id).catch(() => ({ images: [] as any[] }))]);
      chapters.push({ title: reading.chapterTitle, paragraphs: reading.paragraphs, images: (images.images || []).map((im: any) => ({ base64: im.base64, mimeType: im.mimeType, caption: im.caption })) });
      onProgress?.(++done, chapterIds.length);
    }
    printHtml(bookHtml(title, chapters, meta));
  },

  /** Every chapter's workbook, one after another, as one printable worksheet book. */
  async printWorkbooks(title: string, chapters: { id: string; title: string }[], className: string, withAnswers = false, onProgress?: (done: number, total: number) => void) {
    const parts: string[] = [];
    let done = 0;
    for (const c of chapters) {
      const { workbook } = await backendApi.readings.workbook(c.id, true);
      parts.push(workbookHtml(c.title, workbook, { className, withAnswers, bodyOnly: true }));
      onProgress?.(++done, chapters.length);
    }
    printHtml(printDocument(`${title} · workbooks${withAnswers ? ' (answers)' : ''}`, parts.join('')));
  },
};

export const formatBytes = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
