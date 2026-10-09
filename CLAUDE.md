# Pathana Shakthi — CLAUDE.md

AI reading tutor for Indian primary schools (Telugu / Hindi / English), built by 221B Labs.
Students read along with narrated stories, get pronunciation feedback, and teachers can turn
a scanned textbook into read-along content. This file orients Claude Code (or any future
contributor) quickly — it is not marketing copy, it is setup + architecture truth.

## Repo layout

```
src/                 React 19 + Vite 6 frontend (TypeScript)
  components/        UI. TeacherDashboard/ has the OCR + story-generator modals.
                      Pages/ has the routed top-level screens (Login, Faculty, SuperAdmin...).
  services/          Client-side logic: firebase.ts (Auth), offlineStorage.ts (local
                      persistence + sync), speechSynthesis.ts / speechRecognition.ts
                      (Sarvam TTS/STT wrappers), backendApi.ts, publishedReadingToStory.ts
                      (converts a published textbook reading into the Story shape the
                      reader already knows how to show).
  types.ts           Shared TypeScript types for the whole frontend + informally mirrored
                      by server.ts's `any`-typed JSON shapes (server.ts does not import
                      from here — keep both in sync by hand when changing OCR/analysis shapes).
server.ts             Single Express server: serves the Vite app AND the JSON API. Owns
                      Sarvam TTS/STT, Ollama-based textbook/story/pronunciation AI, and the
                      OCR job-orchestration layer that talks to backend/ocr.
server/               Firebase Admin routes (auth verification, curriculum, reading-session
                      sync, analytics) — mounted into server.ts as a sub-router.
backend/ocr/          Standalone Python FastAPI microservice (port 8001) that does the actual
                      OCR. Runs Docling. See "OCR service (Docling)" below — this is not
                      Firebase Functions or anything cloud-hosted, it's a local process.
scripts/              One-off Firebase seed scripts (schools/students/faculty/curriculum).
```

## Dev commands

```bash
npm install
cp .env.example .env        # fill in the values you have; see below for what's required per feature
npm run dev                  # tsx server.ts — serves API + Vite dev middleware on :3000
npm run lint                 # tsc --noEmit
npm run build                # vite build + esbuild bundle of server.ts -> dist/server.cjs
npm run start                # node dist/server.cjs (production, after build)
npm run seed:firebase        # tsx scripts/seedFirebase.ts && seedCurriculum.ts
```

There is no JS test framework installed (no jest/vitest). Node 22 ships a built-in test
runner; TypeScript test files run directly via `npx tsx --test <file>`, no extra dependency
needed. Python OCR tests use stdlib `unittest` for the same reason.

```bash
npm run test        # both suites below
npm run test:unit   # server/*.test.ts + src/services/*.test.ts + src/data/learnPlay.test.ts —
                     # pure OCR-mapping + reading-to-Story conversion logic, no server needed
npm run test:ocr    # backend/ocr/test_main.py — needs backend/ocr's deps installed
                     # (pip install -r backend/ocr/requirements.txt in whatever env/venv
                     # python3 resolves to); does NOT need the EasyOCR model download,
                     # it only exercises build_chapters()/picture_to_payload()/table_to_payload()
                     # against hand-built DoclingDocument objects, never DocumentConverter.convert()
```

## The three backend services

This app talks to three separate local processes. All three are optional in the sense that
the app degrades feature-by-feature if one is missing (see each section), but nothing works
end-to-end without all three running.

### 1. Express server (`server.ts`, port 3000)

Always required — this is the only thing the browser talks to. Serves the frontend and all
`/api/*` routes, and proxies to the other two services below.

### 2. Ollama (local LLM, default `http://127.0.0.1:11434`)

Powers textbook chapter analysis (subject/grade/summary/vocabulary extraction), Read-Along
story generation, and pronunciation evaluation. Install from https://ollama.com, then:

```bash
ollama pull qwen2.5:3b   # or set OLLAMA_MODEL to whatever you pull
```

`OLLAMA_BASE_URL` / `OLLAMA_MODEL` in `.env` control this. If Ollama is unreachable, textbook
analysis falls back to a lightweight local summary per chapter (see
`buildFallbackChapterResult` in `server.ts`) rather than failing outright — OCR'd text and
images are never lost, only the AI-authored summary/vocabulary/objectives are skipped.

### 3. OCR service (`backend/ocr/main.py`, port 8001) — **Docling + EasyOCR**

OCR runs on **IBM Docling** (`docling` PyPI package) for layout/table/picture extraction,
with **EasyOCR** as the text-recognition backend (switched from Tesseract — see below).
Docling's `mode=OcrMode.FULL_PAGE` (the modern, engine-agnostic form of the old
`force_full_page_ocr` flag) avoids a specific failure mode common to Indian-language
textbook PDFs: legacy DTP fonts remap glyphs to arbitrary Unicode code points, so trusting a
PDF's embedded text layer (instead of always rendering + OCRing every page) can silently
produce confident-looking garbage text. Docling also extracts embedded pictures
(`generate_picture_images`) and tables (`do_table_structure`) per chapter.

**Why EasyOCR, not Tesseract:** Tesseract's default trained data struggles with Telugu/Hindi
conjuncts and ligatures common in SCERT textbook fonts. EasyOCR's deep-learning recognizers
are meaningfully more accurate for these scripts, at the cost of a real dependency (PyTorch)
instead of a small CLI binary. **Important constraint:** EasyOCR cannot combine two Indic
scripts in one `Reader` — Telugu and Hindi each need their own recognizer, each paired with
English (which EasyOCR can combine with almost anything). See `EASYOCR_LANG_GROUPS` in
`backend/ocr/main.py`: `"telugu" -> [["te","en"]]`, `"hindi" -> [["hi","en"]]`,
`"english" -> [["en"]]`, and `"auto"` (no language picked) runs **both** the Telugu+English
and Hindi+English passes and keeps whichever recognized more text
(`_chapters_text_volume`/`run_docling_job`) — slower, but only on that fallback path; the
teacher's normal per-upload language pick (`TextbookOCRModal.tsx`) stays a single fast pass.

**Setup:**

```bash
cd backend/ocr
# CPU-only torch/torchvision FIRST, as its own step — plain `pip install torch`
# (which easyocr, in requirements.txt, would otherwise pull in transitively)
# resolves to a CUDA build on Linux and drags in several GB of unused nvidia-*
# CUDA runtime packages, wasted space on a CPU-only host.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

No system package (no `apt-get install tesseract-ocr...`) is needed anymore — EasyOCR ships
as a Python dependency, not a CLI binary.

**First run downloads models** — Docling's layout model (`docling-project/docling-layout-heron`)
from Hugging Face, and EasyOCR's CRAFT text-detector + per-language recognizer weights from
GitHub (`JaidedAI/EasyOCR` releases) — a few hundred MB combined, one-time, then cached
locally (`~/.cache/docling`, `~/.cache/huggingface`, `~/.EasyOCR`). This needs a real internet
connection on first run; after that it works fully offline. If you're behind a restrictive
proxy/firewall, the OCR service will start fine but every OCR job will fail with a
`403`/connection error the first time — this is the model download, not a bug in the app.

`OCR_SERVICE_URL` in `.env` points the Express server at this service (defaults to
`http://127.0.0.1:8001`, i.e. same machine).

**Contract between server.ts and this service** (`POST /ocr`, `GET /ocr/status/:jobId`):
async job pattern — `POST /ocr` returns a `jobId` immediately, `server.ts` polls
`/ocr/status/:jobId` until `status` is `completed`/`failed`. A completed job's `chapters`
field is the important part:

```jsonc
{
  "success": true,
  "filename": "textbook.pdf",
  "pages": 42,
  "languagesUsed": ["te", "en"],
  "chapters": [
    {
      "heading": "Chapter 3: The Clever Crow",
      "pageNumber": 12,
      "paragraphs": ["...", "..."],
      "images": [
        { "base64": "...", "mimeType": "image/jpeg", "pageNumber": 12, "caption": "..." }
      ],
      "tables": [
        { "markdown": "| Item | Count |\n|---|---|\n| Apples | 5 |", "pageNumber": 13, "caption": "..." }
      ]
    }
  ]
}
```

Extracted images are downscaled (`PICTURE_MAX_DIMENSION`, 1600px longest side) and encoded as
JPEG (`PICTURE_JPEG_QUALITY`, 82), not PNG — these are photos/illustrations, not line art, so
JPEG is a large space saving at no visible quality loss. Tables are exported as GFM markdown
via Docling's `TableItem.export_to_markdown()` — `do_table_structure=True` was already
computing them, but they used to be silently dropped entirely (`build_chapters` had no branch
for `TableItem`); they're now attached to their chapter like images are.

`server.ts`'s `chaptersFromDoclingResult()` reshapes this into the `DetectedChapter[]` shape
the rest of the pipeline (`analyzeChapterBatch`, `normalizeChapterResult`,
`buildFallbackChapterResult`, all in `server/textbookOcr.ts`/`server.ts`) already expects.
Chapter analysis is **batched**, not one Ollama call per chapter: `buildChapterBatches` groups
3-4 chapters (up to a combined character budget) into a single Ollama call
(`analyzeChapterBatch`), matching each result back to its chapter by an explicit
`chapterIndex` the model is asked to echo (`matchChapterBatchResults`) — a garbled or
reordered batch response only degrades that batch's chapters to the same per-chapter
OCR-backed fallback a single failed call would use, never the whole book.

**Language selection:** the teacher picks Telugu/Hindi/English in the OCR upload UI
(`TextbookOCRModal.tsx`); `server.ts` sends the matching lowercase word
(`"telugu"|"hindi"|"english"`) to the OCR service, which resolves it to an EasyOCR language
group via `EASYOCR_LANG_GROUPS` (`backend/ocr/main.py`) — see above for why Telugu/Hindi can't
be combined in one pass. EasyOCR uses ISO 639-1 codes (`te`/`hi`/`en`), unlike Tesseract's old
ISO 639-2 (`tel`/`hin`/`eng`).

## Deploying (Render)

Three Render services, one per local process above:

- **Express server** — plain Node web service (`npm install && npm run build`,
  `npm run start`), no Dockerfile needed.
- **Docling OCR** — `backend/ocr/Dockerfile` (Docker runtime, build context = repo root,
  CPU-only torch/torchvision installed as their own step before `requirements.txt` — see
  above). Listens on `$PORT`, not a fixed 8001.
- **Ollama** — `backend/ollama/Dockerfile` wraps the official `ollama/ollama` image;
  `backend/ollama/start.sh` reads `$PORT` into `OLLAMA_HOST` (Ollama binds a fixed port by
  default, which doesn't work on a platform that assigns it at runtime) and pulls
  `OLLAMA_MODEL` (default `qwen2.5:3b`) on boot.

Point the Express server's `OCR_SERVICE_URL`/`OLLAMA_BASE_URL` at the other two services'
Render URLs (private networking between services if available, public URLs otherwise).
Neither Docker service has a persistent disk attached by default (add one per service in
the Render dashboard if you want the Docling layout model and the pulled Ollama model to
survive a restart instead of re-downloading each time) — this is not something the current
Render MCP tooling can provision. Render's Free tier (512MB RAM) is almost certainly too
small for Docling's model loading or for Ollama serving a 3B model; both want real headroom
(2GB+ RAM) to avoid OOM crashes under load. Free-tier services also sleep after 15 idle
minutes and answer `429`/`503` while waking; `server.ts`'s `waitForOcrServiceAwake` pings the
OCR service awake (with backoff) before creating a job for that reason. On free-tier hosts,
set `OCR_PROVIDER=gemini` / `AI_TEXT_PROVIDER=gemini` on the web service so every upload
doesn't first wait for a local service that can't run there (see below).

**Current production setup (Oct 2026):** only `pathana-shakthi-web` runs, with
`OCR_PROVIDER=gemini` and `AI_TEXT_PROVIDER=gemini`; `pathana-shakthi-ocr` and
`pathana-shakthi-ollama` are **suspended** in Render (unused, and too big for the free plan).
The startup banner prints "not used" for a local service whose provider is `gemini`. Resume
both and switch the providers back to `auto` only after moving them to a plan with real RAM.

## Gemini fallback (`server/geminiAi.ts`)

Cloud fallback for both local AI services, so the textbook pipeline works on hosts too small
to run them. `GEMINI_API_KEY` enables it; `OCR_PROVIDER` / `AI_TEXT_PROVIDER` choose
`auto` (default: local first, Gemini when the local service is unreachable, crashes, or reads
nothing), `local` (never Gemini), or `gemini` (skip the local service).

- **Text AI:** `generateWithOllama()` in `server.ts` is the single entry point for every text
  generation (chapter analysis, metadata, quiz, stories, pronunciation), so the fallback lives
  there. After one Ollama failure it goes straight to Gemini for 5 minutes
  (`OLLAMA_COOLDOWN_MS`) instead of paying Ollama's connection/timeout cost on every batch.
  The Ollama JSON schema (`format`) is passed through as Gemini's `responseJsonSchema`.
- **OCR:** `runOcrWithFallback()` → `runGeminiOcr()`. PDFs are split with `pdf-lib` into
  4-page requests (`PAGES_PER_REQUEST`; dense Telugu costs many output tokens per page), 3 in
  parallel. Each returns per-page blocks (`chapter_heading`/`subheading`/`paragraph`/`table`/
  `caption`) through a response schema; `doclingChaptersFromOcrPages()`
  (`server/textbookOcr.ts`, pure + unit tested) turns them into exactly the
  `{heading, pageNumber, paragraphs, images, tables}` chapters backend/ocr returns, so
  `chaptersFromDoclingResult` and everything after it (analysis, publish, student reader) is
  unchanged. A failed or truncated 4-page request is retried page by page; pages that still
  fail are reported as `ocr.failedPages` and shown to the teacher in `TextbookOCRModal.tsx`
  rather than silently missing. **Damaged PDFs:** pdf-lib cannot split some files (broken
  cross-reference table, invalid objects — "Expected instance of PDFDict" on a real upload);
  then `openPdfPageRenderer` (`server/pdfFigures.ts`, pdf.js, which rebuilds what it can)
  renders each page to a 2000px JPEG and the same 4-page requests carry images instead. A page
  pdf-lib can't copy is rendered on its own, and a page that comes back with no text is retried
  once as an image (up to 60 pages; pages that render blank are skipped, never sent). A file
  with under 40 characters of text in total is reported to the teacher ("Almost no readable
  text…") instead of becoming an empty book — an 85-page Hindi PDF once came back as 20
  characters. A file neither library can open asks the teacher to save/print it as a new PDF.
- **Pictures:** Gemini can't return image crops, so `extractPdfImages()` copies embedded JPEG
  streams straight out of the PDF (a PDF JPEG stream is a complete JPEG file — no image
  library). It skips logos repeated on 3+ pages, CMYK/non-JPEG images, images over 700 KB
  (Firestore's 1 MiB/doc limit after base64), and **scanned books entirely** (≥50% of pages
  are one full-page image — extracting those would just duplicate the text as a photo).
  Scanned books therefore publish text-only through the fallback; the Docling path does crop
  pictures out of scans.
- **Models:** a comma-separated chain (`GEMINI_MODEL`, `GEMINI_OCR_MODEL`; default
  `gemini-3.6-flash, gemini-3.5-flash, gemini-flash-lite-latest, gemini-3-flash-preview,
  gemini-3.5-flash-lite, gemini-3.8-flash` — each model has its own free quota and its own
  overload spells, so a long chain keeps a book moving). A 154-page book took 27 min on the old
  3-model chain (3.5-flash out of daily quota, 3.5-flash-lite and 3.8-flash answering 503);
  on 30 Sep 3.6-flash read a test page exactly in ~5 s vs 26 s for 3.5-flash-lite.
  `OCR_CONCURRENCY` is 4. `gemini-2.5-*` is retired for new keys
  (404). A model that refuses (429 quota, 503 overload, 404) is skipped for a cooldown (an
  hour for a daily quota) and the next model is tried immediately.
- **Quota:** on the free tier `gemini-3.5-flash` allows only ~20 requests/day per project; a
  200-page book is ~50 OCR + ~15 analysis requests. Real use needs billing enabled on the
  key's Google AI Studio project, otherwise everything quietly runs on flash-lite (or fails
  once every model's daily quota is gone).
- **Known limitation:** Gemini reads PDFs partly from their embedded text layer. The prompt
  tells it to trust the visible glyphs over a (legacy-font, garbage) text layer, but unlike
  Docling's forced full-page OCR this is not a guarantee.

## Firebase

See `FIREBASE_SETUP.md` for the full walkthrough (project creation, Auth providers,
Firestore, service account, seeding).

### SuperAdmin auth

The SuperAdmin portal (`SuperAdminPortalPage.tsx`, mounted at the obscure URL path
`/superadmin221b`) used to gate itself with a **client-side hardcoded passkey**
(`SUPERADMIN_DEFAULT_KEY` in `authService.ts`, plus two other hardcoded strings) — since
that's frontend source, the "secret" was compiled straight into the public JS bundle and
`grep`-able by anyone, and `/api/superadmin/telemetry` had zero server-side auth check on
top of it. This has been fixed: SuperAdmin login is now real Firebase email/password auth
(`firebaseAuthService.loginWithPassword(email, password, 'superadmin')`, same call faculty/
admin already used), verified server-side by `requireFirebaseUser` + `requireRole(['superadmin'])`
middleware on `/api/superadmin/telemetry`. The account itself comes from
`npm run seed:firebase` (`FIREBASE_SUPERADMIN_EMAIL`, password `FIREBASE_SEED_PASSWORD`),
same as the seeded faculty/admin accounts, with a Firestore `users/{uid}` doc carrying
`role: 'superadmin'`.

The `/superadmin221b` URL itself is still unauthenticated at the route level (App.tsx's
`ROUTE_REQUIRED_ROLE` deliberately does NOT gate `'superadmin'`) — this is intentional, not
an oversight: `SuperAdminPortalPage` self-gates by rendering its own login form when there's
no superadmin session, the same way `/login` itself isn't gated. Adding an App.tsx-level
guard here would break that (it would redirect away before the login form could ever render).
The hidden URL is obscurity on top of real auth, not a substitute for it — don't add a
client-side secret back here if you touch this again.

## Published readings (real OCR content reaching students)

Before this, OCR'd textbook content was a dead end: `TextbookOCRModal.tsx` showed a teacher
the extracted chapters once, then the only "save" action (`StoryGeneratorModal.tsx`) had
Ollama **invent a brand-new fictional story** from a one-line chapter summary — the real OCR
paragraphs and images were discarded, and whatever got saved only ever lived in the browser's
`localStorage` (`offlineStorage.ts`), shown to every student regardless of grade. That's
fixed: a teacher can now publish the actual OCR'd chapter — real paragraphs, real images, real
tables — as something a student in a specific grade actually reads.

**Data model (Firestore, via `server/firebaseAdmin.ts`'s `getFirebaseAdmin()`):**

- `publishedReadings/{id}` — one doc per published chapter: `grade`, `subject`, `language`,
  `bookTitle`, `chapterNumber`/`chapterTitle`, `paragraphs: string[]`, `tables`
  (`DetectedChapterTable[]`, markdown), the per-chapter AI fields already produced by OCR
  analysis (`summary`, `keyVocabulary`, `learningObjectives`, ...), a `comprehensionQuiz`
  generated **from the real paragraphs** (see below), `teacherId`/`teacherName`, `schoolId`,
  `imageCount`, `createdAt`.
- `publishedReadings/{id}/images/{imageId}` — **images live in a subcollection**, one document
  each, not inline on the main doc. A chapter with several compressed JPEGs could otherwise get
  close to Firestore's 1MiB-per-document limit; keeping them separate also means a student's
  list view never has to pull full image payloads for readings they haven't opened yet.

**Routes (`server.ts`, all under `requireFirebaseUser`, publish/delete also under
`requireRole(['faculty','admin','superadmin'])`):**

- `POST /api/readings/publish` — validates `grade` against the five supported grades, calls
  `generateQuizFromRealText()` (Ollama, grounded in the real paragraphs — see below), then
  writes the main doc + image subcollection. An Ollama failure here does **not** block
  publishing (same "don't lose already-extracted content" principle as
  `buildFallbackChapterResult`) — the reading is published without a quiz instead.
- `GET /api/readings?grade=...&subject=...` — lightweight list (`PublishedReadingSummary`, no
  paragraphs/images), scoped to the requesting user's own `schoolId` when known.
- `GET /api/readings/:id` — full reading detail (paragraphs, tables, quiz, vocabulary — still
  no images).
- `GET /api/readings/:id/images` — that reading's images, fetched only when a student actually
  opens it.
- `DELETE /api/readings/:id` — the publishing teacher or a school admin/superadmin only.

**Ollama's role here is deliberately narrow:** `generateQuizFromRealText()` (`server.ts`) asks
for exactly 3 comprehension questions **grounded in the real chapter text**, with the same
closing-remark guardrail used elsewhere — a local model asked for "comprehension questions"
will sometimes produce a meta remark like "shall we read another one?" instead of a real
question; the prompt forbids it and `stripClosingRemarkQuestions()` (`server/textbookOcr.ts`)
filters it out as a safety net. This function **never invents narrative content** — that's the
one remaining thing `/api/stories/generate-from-summary` still does, kept as a secondary,
explicitly-labeled "Or Build an AI Story Instead" option in `TextbookOCRModal.tsx`, not the
primary path anymore.

**Reaching the student:** `src/services/publishedReadingToStory.ts` converts a
`PublishedReading` (+ its images) into the existing `Story` shape, so it reuses
`ReadAlongReader`/`StudentLibraryPage` rather than needing a second reader UI. Paragraphs are
paginated by a per-grade word budget (`paginateParagraphs`/`wordsPerPageForGrade`: 15 words for
Class 1-2, 20 for Class 3, 25 above) so one page fits in a single ~29 s read-aloud attempt; long
paragraphs split at sentence ends (`.!?।॥`) or poem line breaks; images and tables are attached to pages by index, and
any image/table left over once the text pages run out gets **its own page** rather than being
dropped (see the "never dropped" comments in that file — same principle the OCR pipeline
itself follows for a chapter's real content). `StoryPage` gained `imageBase64`/`imageMimeType`/
`imageCaption`/`tableMarkdown`/`tableCaption` for this; `ReadAlongReader.tsx` renders a real
`<img>` in place of the emoji+illustration-prompt banner when `imageBase64` is present, and a
parsed HTML `<table>` (`parseMarkdownTable()`, a small GFM-pipe-table-only parser — that's the
one table shape OCR ever emits) below the text when `tableMarkdown` is present. `Story` gained
`isTextbookReading`/`sourceReadingId` so the reader/library can tell a real reading apart from
an AI-invented one if needed.

`StudentLibraryPage.tsx` fetches `backendApi.readings.list(student.grade)` and shows them in
their own "Published Textbook Readings" section; opening one fetches the full reading + images
and calls the existing `onSelectStory` callback with the converted `Story` — no changes needed
in `App.tsx`'s routing, since it already just holds whatever `Story` object it's given.
**Also fixed in the same pass:** the AI-generated `Story[]` library (`offlineStorage.ts`) was
previously shown to every student regardless of grade; `subjectGroups` in
`StudentLibraryPage.tsx` now filters by `story.gradeLevel === student.grade` first.

**Known remaining gap:** there is still a *third*, separate content system — the static
Firestore `lessons` collection (`server/firebaseRoutes.ts`'s `/api/curriculum`, seeded by
`scripts/seedCurriculum.ts` from `src/data/curriculumData.ts`), shown in its own "Class
Curriculum" section of `StudentLibraryPage.tsx` with a stub, non-interactive lesson experience.
`publishedReadings` does not unify with it — that would be a further, separate piece of work.

## Books, chapters and subjects (AI book structure)

OCR sections are not chapters: a scanned book's raw sections include the cover, contents page,
every sub-heading ("Let us think", "Exercise") and index. `processTextbookJob` therefore runs one
**book-structure pass** (`structureBookWithAi` in `server.ts`) over a compact outline of the raw
sections (`buildBookOutline`), asking for each real chapter's section range, title, number,
`kind` (lesson/story/poem/... or front_matter/contents/index/back_matter) and subject (one of
`BOOK_SUBJECTS` = the six Subject Hub tiles). `applyBookStructure` (`server/textbookOcr.ts`,
unit tested) merges the ranges into chapters (sub-headings kept as paragraphs), drops the
front/back-matter kinds, never loses an unplanned section (appended to the previous chapter),
and falls back to the raw sections if the plan is empty or unusable. Per-chapter analysis then
adds key points, themes, message, difficulty, teaching tips, discussion questions and reading
time on top of summary/vocabulary/objectives.

**Cleanup pass** (`cleanUpBookChapters` in `server.ts`, after the structure pass): OCR reads a
page's decorations as text — a real book published "9 P O E M S", "ENGLISH · LONGING",
"— U N F I N I S H E D —", page numbers and an About page/URL as lines a child had to read.
First rules, no AI (`cleanBookChapters` in `server/textbookOcr.ts`, unit tested on those exact
lines): letter-spaced capitals are collapsed, then counters, dash-wrapped markers, caps
category labels, page numbers, link-only lines and short lines repeated across chapters are
dropped — per paragraph and per line inside a paragraph. Then one AI request per ~40 chapters
(`refineBookWithAi` → `applyChapterRefinements`): section title pages (kind
`section_divider`, also recognised by the structure pass) are dropped and name the **part** of
the chapters after them; front matter found mid-book is treated as a section page; non-body
paragraphs are removed (never all of them) and a title's translation becomes the **subtitle**;
auto-numbered chapters are renumbered. Each chapter's **language comes from its script**
(`scriptLanguage`), also enforced at publish — every chapter of a book uploaded as "English"
used to be listened to in English, even Telugu ones. Latin-script Hindi (Hinglish) stays
English for the microphone, since Hindi STT would answer in Devanagari.
`POST /api/readings/books/:key/clean` ("Clean up book" in My published books) runs the same
pass over an already-published book, keeps chapter ids (student progress survives), deletes the
dropped chapters and fills in deep analysis for chapters published without it. Students see
parts as headings in the book's chapter list and the subtitle under the title in the reader.

Teacher UI (`TextbookOCRModal.tsx`): book header, subject filter chips, chapter list + detail,
per-chapter subject override, and **Publish whole book** (`POST /api/readings/publish-book`: one
`bookId`, `chapterOrder`, `chapterCount` for every chapter; quiz per chapter; 3 at a time).
Single-chapter publish still exists. `DELETE /api/readings/book/:bookId` removes a whole book.
The publish class defaults to the class chosen on the faculty dashboard (`defaultGrade`); the
AI's grade guess is only shown as a hint (it once sent a Class 5 book to Class 3).

**My published books** (`PublishedBooksPanel.tsx` on the faculty dashboard) lets a teacher fix a
publish without re-uploading: `GET /api/readings/books/mine`, `PATCH /api/readings/books/:key`
(`{grade}` — move to another class), `POST /api/readings/books/:key/clean` (see Cleanup pass above),
`POST /api/readings/books/:key/fill-quizzes` (generate the
comprehension questions that failed at publish time, one chapter at a time), `DELETE
/api/readings/books/:key`. `key` is the `bookId`, or `reading:<id>` for older single-chapter
publishes. Faculty manage their own; admins their school's; superadmin all. On the free Gemini
tier a 40-chapter book bursts past flash-lite's 15 requests/minute, so the model chain now waits
out short cooldowns up to 4 times (`MAX_ROUNDS` in `generateWithModelChain`) and whole-book
publishing runs 2 chapters at a time; any chapters still left without a quiz are reported in
the publish result.

Student UI (`SubjectStoriesPage.tsx`): each subject tile shows its books
(`groupReadingsIntoBooks`: by `bookId`, older publishes by title; chapters ordered by
`chapterOrder`, then chapter number) with progress, Start/Continue (first unread chapter) and
the chapter list. Opening a chapter passes the book's chapter list (`bookContextFor`) into the
`Story`, so after the quiz `RewardChestModal` offers **Next Chapter** (`nextChapterOf` →
`App.tsx`'s `handleNextChapter`). The reader is keyed by story id so the next chapter starts at
page 1. In the reader, Next unlocks at 70%+ **or** after one scored attempt / two unscored ones
(mic errors), so a hard page never traps a child; stars are still only for 70%+ pages. Closing
the quiz, certificate or rewards never leaves the child on a finished reader.

TTS language comes from the text's script (`server/speechLanguage.ts`): Sarvam rejects text
with no characters of the requested language, e.g. an English word inside a Telugu story.

## Pages, paragraphs and pictures

- **Page breaks and long chapters** (`server/textbookOcr.ts`, unit tested): at publish,
  `joinPageBreakParagraphs` rejoins a sentence the OCR split at a page break (no sentence end +
  lowercase start on the next page), and `publish-book` runs `splitLongChapter` with
  `maxChapterWordsForGrade` (Class 1: 150 words … Class 5: 550) so a long story becomes
  "Title (Part k of n)" chapters cut at printed-page boundaries, pictures/tables going with their
  page. An 11-page, 2,500-word story had become one 156-step reading.

- **One reader page per paragraph/stanza** (`paragraphPieces` in `publishedReadingToStory.ts`):
  paragraphs are never merged; a blank line inside an OCR block also starts a new page; a
  paragraph longer than one read-aloud attempt (`wordsPerPageForGrade`) continues on the next
  page.
- **Printed page numbers per paragraph** (`paragraphPages`, parallel to `paragraphs`) flow from
  Gemini OCR (`doclingChaptersFromOcrPages`) through structure/cleanup (`pagesOf`) to Firestore;
  the reader's counter shows "📖 Book p. N · step x/y" (`bookProgress`), never "Page 37 / 156". Pictures and tables go on the reader page whose text came
  from their printed page (`targetPageIndex`); a second picture from the same page gets its own
  page right after, never at the end.
- **Pictures in scanned books** (`server/pdfFigures.ts`): Gemini OCR also returns `figure`
  blocks with a 0-1000 box; for pages with no embedded JPEG, the page is rendered with
  `pdfjs-dist` (its bundled `@napi-rs/canvas`, prebuilt, no system libs — always draw with
  `doc.canvasFactory`, a separately installed canvas package fails with "Value is none of these
  types") and each box is cropped to JPEG (`figureCropRect`: padded, skips tiny and whole-page
  boxes, ≤700 KB). `getDocument` gets `wasmUrl`/`iccUrl` (pdfjs-dist's `wasm/`, `iccs/`):
  scanned school books often store pages as JBig2 images, and without the decoder pdf.js
  skipped them ("JBig2 failed to initialize") and crops came out blank; a crop that is still
  blank (`isBlank`) is dropped rather than published. pdf.js is loaded with a `new Function` import because the esbuild CJS bundle
  would otherwise turn `import()` into `require()`.

## Quizzes, scripts and fonts

- `generateQuizFromRealText` writes 5 candidates in the chapter's own language **and script**
  (Telugu script / Devanagari, English translation in `questionEnglish`) under strict rules
  (one defensible answer, options of one kind, unambiguous wording), then a second AI pass
  checks each against the passage (keep/fix/drop). Quizzes carry `quizVersion` (2);
  `quizIsStale` flags missing, pre-v2 or wrong-script quizzes, and "Fix questions" in My
  published books remakes them (`fill-quizzes`, mode `stale`). This came from a real quiz that
  asked "Whose role in Missamma…" with the actress and her characters mixed as options.
- **Never a chapter without questions:** when the AI can't write them (on 4 Oct the free Gemini
  quota ran out mid-publish and 31 of 35 chapters got none), `buildFallbackQuiz`
  (`server/textbookOcr.ts`, unit tested) makes up to 3 "fill in the missing word" questions
  from the chapter's own sentences, in its own script, with wrong options taken from other words
  of the chapter (`quizSource: "text"`, AI ones `"ai"`). Publish and "Fix questions" both use it.
- **Romanized Hindi/Telugu** (e.g. "Woh ladki ek khwab thi") is flagged by the refinement pass
  (`script: romanized_hindi`) and transliterated — never translated — into Devanagari/Telugu
  script (`transliterateChapters`), titles too; the chapter's language/subject become Hindi.
  Hindi STT answers in Devanagari, so Latin text could never be matched word for word.
- Fonts: `index.html` loads Noto Sans Devanagari + Telugu, and both are in the body stack and in
  Tailwind's `--font-sans` (`src/index.css` `@theme`) — `font-sans` is on most pages and used to
  drop to the system font, which breaks conjuncts/matras on many phones.

## Learn & Play (built-in chapters)

`src/data/learnPlay.ts` defines 23 chapters across all six Subject Hub tiles, each tagged with the
classes it is written for (`grades: [from, to]`; `labChaptersFor(subject, grade)` filters), e.g.
Maths: counting (1-2), clock (2-4), multiplication and fractions (3-5); Science: senses (1-2),
food groups (3-5); Social: festivals (1-3), states of India (4-5); English: opposites, nouns and
verbs. `subjectsForGrade` gives Class 1-2 English/Maths/Science/Telugu and Class 3-5 all six;
a tile also appears when a book is published for it. Each is
Learn (animated cards, `LearnScene.tsx`) → Play (a game in `src/components/learnplay/games/`) →
Read (the chapter's lines as a `Story` through the normal mic reader + quiz, id `lab_<id>`).
Maths numbers scale by class (`mathsLimitForGrade`; Class 3+ addition uses tens rods/ones cubes
with visible regrouping). The shapes game is a real three.js scene (drag to spin, emoji
fallback without WebGL). Progress/stars per student in localStorage (`learnPlayProgress.ts`,
only improvements add stars) and on the server (`progressSync`, see Students below). Each
flashcard reads itself aloud; its words are tappable (`SayIt`, slow pace). Saying the card is
encouraged, never required — Next is always open (a teacher asked for this). Route `learn_play`, URL `/learn/<id>`. Shakthi Mitra
(`/shakthi-face-256.png`, `MitraGuide`) guides Learn & Play, the quiz and rewards;
`MascotBuddy` in the reader is the tiger too. 3D look: `.btn-3d`, `.card-3d` in `index.css`.

## Field feedback round 2 (8 Oct)

- **Counting animations** (`src/components/learnplay/CountingScene.tsx`, `LabCard.count`): maths
  cards show their example being counted — things appear one at a time while a big number
  flashes the count, two baskets join and are recounted ("3 + 2 = 5"), balloons fly away one by
  one and what is left is counted, plates are filled then skip-counted (2, 4, 6), frog hops on
  the number line are numbered. `stage` picks which part of the chapter's example a card shows.
- **Picture text is not lesson text:** the Gemini OCR prompt keeps speech/thought bubbles, labels
  drawn on illustrations and signboards out of paragraphs/captions (only in the figure's
  description). Books published before this keep what they have.
- **Resume everywhere** (`src/services/resumePoints.ts`): every story/textbook chapter remembers
  the reader page plus the scores of pages already read (`story_<storyId>`), and every Learn &
  Play chapter its step and card (`lab_<chapterId>`). Saved per child on the device and synced as
  activity `position` (only the latest place per key stays queued) to `students/{id}.positions`;
  `/student/me` returns them and `applyServerStudent` merges newer ones, so a place follows the
  child to another device. The reader shows "Welcome back" + "Start from the beginning"; a
  finished story clears its place (`done`). The book's chapter list shows "Continue · n% done".

## Chapter workbook (unit structure)

Every published chapter has a workbook in the order teachers asked for: 📖 Lesson → ✏️ Fill in
the blanks → ❓ Questions & answers → 🎯 I can… (learning outcomes) → 💭 What I learned
(reflection + "I need help from my teacher") → 🎨 Activity.
- **Server** (`server/unitWorkbook.ts`, unit tested; `GET /api/readings/:id/workbook`): a
  text-only workbook is always built from what publishing stored (key points, vocabulary, the
  chapter's own sentences as blanks via `buildFallbackQuiz`, quiz + discussion questions,
  objectives as "I can…", reflection/activity templates in English/Telugu/Hindi). The first
  request also starts one AI request (`makeAiWorkbook`, `[WORKBOOK]` log line, at most every 6 h
  per chapter) whose result is checked by `normalizeAiWorkbook` (a blank's answer must be in the
  chapter text, one blank, 3 wrong options; a section with fewer than 2 good items keeps the
  text version) and stored on the reading as `workbook` (`WORKBOOK_VERSION`).
- **Student** (`UnitWorkbookPanel.tsx`, opened with `openWorkbook()` → `UnitWorkbookHost` in
  `App.tsx`): from 📝 next to each chapter in the book's chapter list and from the rewards after
  reading a textbook chapter. Every line has 🔊, Next is always open, blanks score the first
  try, answers are "Check the answer" then "I knew it / Still learning". Answers are kept per
  child on the device (`ps_workbook_<student>_<reading>`, including the workbook itself, so a
  later AI version never mixes with answers given to the old one) and sent as activity `unit`
  → `unitResponses/{studentId}_{readingId}` (scores, self-rating 0-2 per outcome, feeling,
  note, `needHelp` + `helpQuestion`, activity done); finishing gives 10 stars once a day.
- **Print** (`src/services/printWorkbook.ts`): 🖨️ prints the workbook as a worksheet (name/roll
  line, blanks with word options, writing lines, I-can faces) through a hidden frame.

## Classes 6-10 (Telangana syllabus and simulation labs)

- **Classes everywhere:** `src/data/grades.ts` (`ALL_GRADES` = Class 1-10, `gradeNum`, `isHighSchool`)
  feeds every class picker (login tiles, roster, teachers, dashboards, OCR publish); the server
  accepts Class 1-10 (`VALID_GRADES` in `server.ts`, `server/studentRoutes.ts`). Reader pages hold
  32 words for Class 6-8 and 40 for 9-10; `maxChapterWordsForGrade` keeps growing past Class 5.
  `seed:students` gives Class 6-10 five children each (ids `PS2026<class><roll>`, e.g.
  `PS202610001`), and Sri. Rajeshwar Rao (`fac_4`) teaches Class 1-10. The dictionary has
  Class 6-10 textbook words (science, maths, social; English/Telugu/Hindi, `grades: [6, 10]`,
  `dictionary.test.ts`); older classes still see the easier words too.
- **Syllabus** (`src/data/telanganaSyllabus.ts`): SCERT Telangana textbooks per class and subject
  tile — books (Science splits into Physical/Biological Science from Class 8), units (English,
  Telugu, Hindi, Social) and chapters. A few lists are partial and say so in comments (Class 10
  English units 5 and 8, an untitled Class 8 English unit). `SyllabusPanel` on the subject page lists them with
  🎮 Lab (when the chapter has a `labId`), 📘 Read (a published chapter whose title matches,
  `matchReading`/`syllabusTitleKey`) and 🐯 Ask (opens Ask Mitra about that chapter, kind `chapter`).
- **Simulation labs** (`src/data/learnPlayHigh.ts`, 23 chapters, game kind `sim`): each Learn card
  carries a live simulation (`sim: {kind, variant}`) and cards can be limited to some classes
  (`grades`, `labCardsFor`), so hs-circuits teaches Class 6 conductors and Class 10 Ohm's law.
  `labChaptersFor` shows a lab only in the classes whose syllabus names it. Simulations live in
  `src/components/learnplay/sims/` (one lazily loaded chunk per group, `sims/index.tsx`):
  maths (integers, fractions, equation balance, triangle angles, line/pair/parabola graphs, unit
  circle, probability, Venn), physics (circuits + Ohm's law/series/parallel, magnets + field of a
  current, motion + d-t/v-t graphs + equations of motion, Snell's law + total internal reflection,
  lens ray diagrams from 1/v − 1/u = 1/f), chemistry/biology (indicators + pH, Rutherford gold
  foil + Bohr shells Z 1-20 with valency/group/period, Hydrilla photosynthesis, double
  circulation), earth/history (three.js solar system with true period ratios and an SVG
  fallback, orthographic globe with Hyderabad and IST, seasons with real Hyderabad day lengths,
  National Movement and Telangana formation timelines). The Play step is `ChallengeRunner`:
  5 generated, animated questions. `sims.test.ts` checks every round maker (distinct options,
  no NaN) and the physics/chemistry/astronomy helpers against textbook values.

## Students, classes and security

- **Roster and login:** `scripts/seedStudents.ts` (`npm run seed:students`) keeps `students`
  docs for Class 1-10 (roll numbers as strings; ids `PS2026<class><roll>`, Arjun Kumar keeps
  `PS20260017`, Class 5 roll 17). Re-running it rewrites names/classes but never a child's progress.
  Students sign in on `LoginPage` by tapping their class, then their name (or typing their
  roll number); `StudentClassRollFields` shows the class list from `GET /api/auth/class-roster`
  (public, rate limited, cached: first name + surname initial, roll, avatar — no ids or full
  names) and confirms "name · class · roll" before signing in; `POST /api/auth/student-login` (`server/studentRoutes.ts`, rate
  limited) finds the child, upserts `users/student_<id>` (role `student`) and returns a Firebase
  **custom token** → `signInWithCustomToken` (`firebaseAuthService.loginStudentByRoll`). The
  browser therefore never says which student it is; the anonymous session and
  `/auth/student-session` are gone, and so are `/reading-sessions` + `/sync/reading-sessions`,
  which trusted a `studentId` in the body.
- **Quiz bonus stars** (`src/services/quizBonus.ts`, activity type `quiz`): 5 per right
  answer + 10, once per story per day (server checks `quiz_<storyId>` in that day's
  activity). The quiz screen used to promise "+15 Bonus Stars" that were never added; now they
  are recorded and shown in the treasure chest, and a retake says the bonus is already earned.
- **Progress:** `src/services/progressSync.ts` queues each reading/game/word/quiz activity in
  localStorage and posts it to `POST /api/student/activity` (values clamped, reading ids
  de-duplicated, streak and `dailyActivity.<child's local day>` kept server side), then folds the
  server record back into the local student (`applyServerStudent`; `STUDENT_UPDATED_EVENT`).
  `App.tsx` calls `progressSync.refresh()` at sign-in. The queue is re-read before every
  change, so an activity recorded while a flush is sending (the quiz right after its reading)
  is never overwritten, and `record` flushes again after a running flush. The learning tree grows from any three
  activities a day (`offlineStorage.recordDailyActivity`: `read_<story>`, `game_<chapter>`,
  `words_<day>`).
- **Scoping:** a student's `/api/readings*` requests only ever return their own class and school
  (`studentMayRead`); `/api/class/*` is staff only.
- **Class dashboard** (`ClassDashboard.tsx` on the faculty page, `server/classRoutes.ts`):
  `GET /api/class/:grade/overview` (totals, 14-day readings + accuracy, reading-level bands,
  subjects, hard words, every student, Shakthi Mitra's plain-language notes) and
  `/api/class/:grade/students/:id` (drawer: accuracy per reading, recent readings, hard words,
  Learn & Play stars, dictionary practice). Charts are plain SVG in `TeacherDashboard/charts.tsx`
  (one hue, hover tooltips, a table view). The sidebar (`Navbar.tsx`) is per role — teachers get
  Class Dashboard, never the student portal.
- **Word Dictionary** (`WordDictionaryPage.tsx`, route `dictionary`, URL `/dictionary`):
  `src/data/dictionary.ts` (English/Telugu/Hindi words by class with meaning, emoji and how
  Telugu/Hindi sounds), the `keyVocabulary` of the class's published books (now in the
  `/api/readings` list) and the child's own hard words; tap = slow pronunciation, then `SayIt`.
  Practice is recorded as `word` activity (`wordPractice` collection). **Only real dictionary
  words with a meaning appear:** book words and hard words are shown only if they are in the
  built-in list or are Oxford headwords (`server/dictionary.ts`: Oxford Dictionaries API v2,
  `OXFORD_APP_ID`/`OXFORD_APP_KEY`, lemma fallback for "mangoes" → "mango", cached in
  Firestore `dictionaryCache`; `POST /api/dictionary/lookup`). Without Oxford keys only the
  built-in list shows. With them, the Oxford definition also appears next to the child-friendly
  meaning of built-in English words. Built-in meanings are written for children, not copied
  from Oxford.
- **AI tutor — "Ask Shakthi Mitra"** (`AskMitra.tsx`, `server/tutorRoutes.ts`,
  `POST /api/tutor/ask`): a button on the student home, reader, Learn & Play and dictionary.
  Suggested questions come from what is on screen (explain this page, what does "X" mean, help
  me say "X", quiz me), so a child who can't type can still ask; answers are short, grounded in
  the on-screen text, in simple English (Telugu/Hindi if the child writes in that script),
  learning-only, spoken aloud, with 2-3 tappable follow-ups. Uses `generateWithOllama`
  (Gemini fallback); 12/min per child plus `TUTOR_DAILY_LIMIT` (80) a day; questions are not
  stored, only a `[TUTOR] role grade kind -> ms` log line.
- **Hardening** (`server/security.ts`): per-client in-memory rate limits (global 600/min, plus
  login, OCR, story AI, publish, speech), security headers, `trust proxy`, 1 MB default JSON
  bodies (100 MB only for OCR upload and publish, 15 MB for `/api/speech/*`), auth + staff role
  on OCR/story generation/OCR status, and a 60 s cache of `users/{uid}` profiles in
  `requireFirebaseUser`. Rate limits are per instance — use a shared store if the web service is
  ever scaled out. Firestore rules stay deny-all (server-only access).

## Teacher and headmaster dashboards

- **Teacher** (`FacultyPortalPage.tsx`): tabs Class dashboard / Students & roll numbers /
  Published books / Learn & Play progress, opening on the teacher's own class
  (`GET /api/school/my-classes`: `users.grades`, or `faculty/{id}.assignedGrades` for seeded
  teachers). The old static "Class-wise Lessons" library (invented lessons, a no-op Start button)
  was removed. The class dashboard gained **"Plan my week"** (`ClassPlanCard.tsx` →
  `POST /api/class/:grade/plan`, `createClassPlanRouter` in `server/classRoutes.ts`): the AI gets
  only that class's numbers and first names (`buildClassPlanPrompt`), names in the answer are
  filtered to real students, cached 10 min per class, 6/min — and **Download (Excel)**
  (`src/services/csv.ts`, formula cells escaped, UTF-8 BOM for Telugu/Hindi names).
- **Headmaster** (`SchoolAdminPage.tsx`, `/admin`; it used to read empty localStorage): live
  `GET /api/school/overview` (`server/schoolRoutes.ts`, `buildSchoolOverview` unit tested) — Mitra's
  notes (classes without a book/teacher/activity, children below 50%), totals, readings per day,
  active children per class, classes side by side (Open → that class's dashboard, CSV export);
  tabs for class dashboards, **Teachers**, students and published books.
- **Class lists** (`RosterPanel.tsx`, teachers and admins, own school only): `GET/POST
  /api/school/students`, `PATCH /api/school/students/:id` (name, roll, class, picture, active).
  Roll numbers are unique per class **across schools** among active children, because sign-in
  asks only for class + roll. "Left school" deactivates (progress kept, `users/student_<id>`
  marked `active:false`, tokens revoked); the public class roster cache is cleared on every
  change (`forgetRoster`). "Sign-in cards" prints each child's name, class and roll number.
  Children added in the app carry `addedBy`, and `seed:students` never deletes them (it still
  rewrites the seeded children's names/classes).
- **Teacher accounts** (`TeachersPanel.tsx`, admin/superadmin): `POST /api/school/teachers`
  creates a Firebase Auth user + `users/{uid}` (`role: faculty`, `grades`) and shows a temporary
  password once (`tempPassword`, no look-alike characters); `PATCH /api/school/teachers/:uid`
  changes classes, resets the password (old one revoked) or deactivates (Auth `disabled` + tokens
  revoked). `requireFirebaseUser` rejects any profile with `active: false` (within the 60 s
  profile cache), so a deactivated account stops working before its ID token expires.
  Superadmin acts on `?schoolId=` or the first school.

## English first

English is the default everywhere (landing, voice setup, OCR language, story generator, speech
recognition, server language defaults) and is listed first; Shakthi Mitra's cheers and reader
prompts are always English (`playEncouragement` ignores the story language). Content itself —
a Telugu story, Hindi quiz — stays in its own language and script.

## Layout and resilience notes

- **Home** (`homeRouteFor` in `src/services/homeRoute.ts`) is each role's own page — student
  library, class dashboard, school admin, superadmin — for the sidebar, `/` and any in-app jump
  to `landing` while signed in. The public landing page shows the signed-out navbar, so "Home"
  used to look like a logout.
- The signed-in sidebar is fixed at 76px; `App.tsx`'s `<main>` offsets every screen except
  landing/login/reader — pages must not add their own `pl-[76px]`.
- **One sign-in per browser:** the session (localStorage) and the Firebase account (IndexedDB)
  are shared by every tab, so a student signing in on a second tab signed the teacher's tab in
  as that student too (its upload was refused "not authorized"). `authService.watchOtherTabs`
  reloads a tab into the new account's home when another tab signs in as someone else or signs
  out, and `requireRole` says so when a student token reaches a staff route. To test teacher and
  student side by side, use a separate browser profile or an Incognito window.
- API calls and the SuperAdmin telemetry wait for `firebaseAuth.authStateReady()`; right after a
  reload the user is not restored yet and requests went out without a token (401).
- `kidSpeech.speakSarvamAudio` falls back to the device voice (`speakNativeBrowser`) when the
  narration API or Web Audio fails instead of throwing an unhandled error.

## Teammate fixes (3 Oct)

- **OCR upload survives a restart/sleep:** `TextbookOCRModal.tsx` retries the upload POST on
  502/503/504 ("Waking up the server…") and treats a 502/503/504 or non-JSON status poll as a
  temporary outage (reconnects for up to 60 tries, restarts a lost job at most twice). A Render
  deploy or wake-up used to show "invalid status response (HTTP 502)" mid-book.
- **Device-voice fallback** (`speakNativeBrowser`): picks a device voice of the selected
  narrator's gender (`voiceGender`, `wantedGender`), shifts pitch when only the other gender
  exists, and, when the device has no Telugu/Hindi voice, speaks the dictionary's romanized
  `sounds` with an English voice instead of mangling the script. Sarvam itself still gives the
  right voice; these are what teammates heard while Sarvam had no credits.
- **Dictionary:** every Telugu/Hindi word has a simple sentence (`INDIC_EXAMPLES` in
  `src/data/dictionary.ts`), so "Read the sentence" shows for all three languages; cards show
  "sounds like …"; Indic words get extra line height so matras/conjuncts aren't clipped.
  The voice-setup try-out no longer prints the romanized word under each word.
- **Punctuation is not a word:** a "–" or "—" token is shown as plain grey text in the reader
  and `SayIt`, and `speechRecognition.ts` skips punctuation-only tokens (they used to count as
  missed words). English articles ("a"/"the", heard as "uh"/"duh") are matched leniently.
- **Duplicate publishes / glyph boxes:** `dropDuplicatePublishes` hides a chapter published
  both as a whole book and on its own (same class + book + chapter); `stripUnreadableGlyphs`
  removes ■/�/private-use characters (legacy-font OCR) from paragraphs and tables, at publish
  and when a student opens an older reading; `cleanTableMarkdown` drops columns left empty.
- **Learn & Play:** Maths cards are listen-only (`SayIt listenOnly`); the game result says
  "Game rating: n of 3 stars", "x of y answers right on the first try" and, separately,
  how many ⭐ were added to the collection (or that they were already earned).

## Field-test hardening (4 Oct)

- **Crash screen + error log:** `AppErrorBoundary` (`src/main.tsx`) shows "Oops! Something went
  wrong" with Try again / Go home instead of a blank page; `src/services/clientErrors.ts`
  reports render errors, `error` and `unhandledrejection` events (noise filtered, ≤10 per page
  load) to `POST /api/client-error`, logged as `[CLIENT-ERROR] kind at /path: message | stack`.
  Read these in the Render logs after a classroom session.
- **Speech endpoints need sign-in:** `/api/speech/synthesize`, `/transcribe` and
  `/evaluate-pronunciation` use `requireFirebaseUser` (they used `optionalFirebaseUser`, so
  anyone could spend Sarvam credits). The browser already sends the token via `authHeaders()`.
- **Hindi/Telugu spelling variants** in read-aloud matching (`cleanWord` in
  `speechRecognition.ts`): हूं = हूँ, मां = माँ (anusvara/chandrabindu), पेड = पेड़ (nukta),
  zero-width joiners and all Unicode punctuation ignored. A child reading "हूँ" correctly was
  marked wrong because STT wrote "हूं".
- **Load speed:** `compression()` gzips responses (app JS 1.8 MB → ~0.5 MB); hashed `/assets/*`
  are cached for a year, `index.html` is `no-cache`. The 1254px mascot PNG (896 KB) is
  `shakthi-face-512.png` (186 KB) where it is shown large.

## Voice (Sarvam AI)

TTS is Sarvam Bulbul v3, STT is Sarvam Saaras v4 — `SARVAM_API_KEY` in `.env`
(https://dashboard.sarvam.ai). Language codes are `te-IN`/`hi-IN`/`en-IN`; the speaker map
(priya/shubh/neha/ratan/ishita/suhani) is in `server.ts`'s speech routes.

**Instant voice:** `/api/speech/synthesize` caches clips in memory (LRU, `TTS_CACHE_MB`, 64 MB)
and shares identical in-flight requests; the browser keeps clips in memory and in Cache Storage
(`ps-tts-v4`) and `kidSpeech.prefetch`/`prefetchWords` fetch the next flashcards, the reader's
next page ahead of time, **one at a time** (fetching every word on screen, 3 at a time, hit
Sarvam's rate limit in production and pushed real taps onto the robotic fallbacks). The server
gates Sarvam (`acquireSarvamSlot`: `SARVAM_TTS_CONCURRENCY`, default 3; a rate-limit answer
pauses Sarvam 15 s doubling to 2 min; prefetches run only when Sarvam is idle and never wait).
The browser always waits for Sarvam's clip (the 2 s switch to the device voice was removed on
4 Oct: a teacher heard a robotic, non-Indian voice mixed into lessons). Tapped words play at
`SLOW_WORD_PACE` 0.8. Prefetches send `prefetch: true`; a prefetch the server skips is answered `204` (not an error), never shares an
in-flight request with a clip a child is waiting for (server `flightKey`, client
`prefetchKeys`), and a waited-for clip whose prefetch was skipped is requested again for real.

**When Sarvam's account fails** (402 no credits, 401/403 bad key — production ran out of
credits on 3 Oct): `noteSarvamAccountProblem` logs one `[SARVAM]` warning and skips Sarvam for
10 minutes (`SARVAM_ACCOUNT_PAUSE_MS`) for both TTS and STT, so every word goes straight to
the fallbacks instead of paying a failed round trip. A rate-limited key (429) hands the request
to the next key not tried yet (`SarvamKeyPool.another`) before Sarvam is paused. When no Sarvam
key can answer, the server answers `502` with one log line a minute (`logVoiceOutage`) and the
browser uses the device voice for 15 s without asking again (`CLOUD_VOICE_RETRY_MS` in
`speechSynthesis.ts`). A transcription no service can do
returns a friendly 502 message instead of a stack trace. **Fail fast for people waiting:**
`generateWithModelChain(..., { waitForCooldowns: false })` (reading checks, the tutor and the
class plan, via `interactive: true`) tries each available Gemini model once and never sleeps
through cooldowns; on 3 Oct a book being read used up the free quota and reading checks queued
behind it for 20-70 s. Book processing (OCR, analysis, quizzes) still waits patiently.

**Several keys:** `SARVAM_API_KEY` and `GEMINI_API_KEY` both take a comma-separated list.
Sarvam (`server/sarvamKeys.ts`, unit tested): one key is used at a time; a key answering
402/401/403 is skipped for 10 minutes and the next key answers the same request, and at
startup one tiny request per key logs `[SARVAM] key n of m (…abcd): ok` or its error (whole
keys are never logged). Gemini (`expandModelRoutes` in `server/geminiAi.ts`): each model is
tried on every key before the next model (`model`, `model#2`, `model#3`…), with cooldowns per
model+key, so one free key's daily quota running out leaves the same model usable on the
others. Free-tier keys only add quota when they come from different Google projects.

**System check** (`server/systemCheck.ts`, unit tested; SuperAdmin overview → "System check",
`GET/POST /api/superadmin/system-check`): Firestore read, every Sarvam and Gemini key, each
language × female/male voice at pace 1 and 0.8 (spoken by Sarvam, then transcribed back by
Sarvam STT and scored by `wordMatchPercent`), the words teachers reported (माँ कुत्ता पेड़ आँख
పిల్లి river garden forest) at the slow tap pace, and the Gemini STT fallback. Runs once per
deploy (fingerprint of commit + keys in Firestore `systemChecks/latest`, so a free-tier wake-up
doesn't repeat it; `RUN_SYSTEM_CHECK=1` locally) and logs `[CHECK] PASS|WARN|FAIL …` lines.
~40 short Sarvam calls per run; manual runs are 2 minutes apart.

**Voice settings** (`server/ttsSettings.ts`, `server/pronunciationCheck.ts`, both unit tested):
every clip uses **Sarvam's default temperature** (none sent), the same request as the other
branches. On 4 Oct lone words were sent at temperature 0.01 and sentences at 0.55 — slightly
more exact when transcribed back (lone words 82% -> 87%), but a teacher testing it found the voice
much worse, flat and robotic, so it was reverted. Do not lower the temperature again for
accuracy; fix single words with the dictionary below instead. A tapped word / flashcard word (no
spaces) still ends with a full stop (`.`, Hindi `।`) so it is said as a complete word.
`TTS_SETTINGS_VERSION` (4) and the pronunciation dictionary's hash are in the server clip-cache
key, and the browser cache is `ps-tts-v4` (older ones are deleted), so a clip made under old
settings is never replayed.

**Pronunciation dictionary** (`server/pronunciationDictionary.ts`, unit tested; Sarvam's
pronunciation dictionary API, bulbul:v3): `PRONUNCIATION_FIXES` respells the English words Sarvam
said wrongly on their own (star -> "sstar", bird -> "burd", hand -> "hannd", brave, cube, den,
whoosh, yellow; also as "Star" and "STAR"). A dictionary belongs to one Sarvam account, so at
startup `SarvamDictionaries.ensure` creates one per key (or updates it in place when the fixes
change; ids remembered in Firestore `systemChecks/sarvamDictionaries`), logs `[SARVAM]
pronunciation key n of m: dictionary p_… created|updated|up to date`, and the TTS route sends
the `dict_id` of the key it uses (`SARVAM_PRONUNCIATION_DICT_ID` is only a fallback). Every entry
was measured: four respellings each (`PRONUNCIATION_CHECK=experiment-respell`), then the word
without vs with the live dictionary plus every sentence containing it
(`PRONUNCIATION_CHECK=confirm-dictionary`, `[DICT-CHECK]` lines); ear, sad, police and important
were dropped because the respelling did not help or made it worse. Hindi/Telugu words tested
(पिता, चाँद, हाथ, వాన) were already right.

**Pronunciation check:** every dictionary word and sentence, Learn & Play card/line/game word and voice sample (447 items; lone words twice in both
voices) is spoken, transcribed back by Sarvam STT, Gemini gives a second opinion on misses, and each
try is "exact", "other spelling" (`phoneticKey`) or a miss — SuperAdmin → System check → "Check
every word" (≈10 min, 30 min apart), or after a deploy with env `PRONUNCIATION_CHECK=verify`
(`experiment`, `experiment-telugu`, `experiment-telugu-endings` compare settings; the
experiments' low-temperature variants are for measurement only, see Voice settings); logged as
`[PRONUNCIATION]` lines. Remove the env var afterwards (each run is ~1,900 Sarvam calls). **These
spend real Sarvam credits:** on 4 Oct the day's experiments emptied one of the three keys, so
never run them (or "Check every word") just before classroom use.
**Read-aloud matching** also accepts another spelling of the same Telugu/Hindi word
(`src/services/phonetic.ts`: చేయి = చెయ్యి, వానా = వాన, doubled consonants, long/short vowels) and
words STT joined or split ("పిల్లిపాలు" = "పిల్లి పాలు"), numbers STT wrote as digits ("5" = "five",
"28" = "twenty eight", Telugu/Hindi 0-10) and English sound-alikes ("I" = "eye", `canonicalWord`);
different words (పెళ్లి / పిల్లి, "6" / "five") still fail. Still weak as lone English words (4 Oct):
"ear" and "eat" — fine inside sentences.

**Gemini voice fallback:** when Sarvam fails (no credits — which is what broke read-aloud in
production once — outage, or no key), `/api/speech/transcribe` falls back to Gemini
(`transcribeAudioWithGemini` in `server/geminiAi.ts`). Narration does **not**: children hear only
Sarvam's Indian voices, and `synthesizeSpeechWithGemini` speaks only with `SPEECH_PROVIDER=gemini`
or when no Sarvam key is configured (its voices are not Indian and the free quota is ~3/min). `SPEECH_PROVIDER` = `auto` (default) / `sarvam` / `gemini`. Measured on
browser-recorded webm/opus: `gemini-3.5-flash-lite` transcribes Telugu/English word-for-word in
~1-4 s (chain overridable with `GEMINI_STT_MODEL`); TTS uses `gemini-3.8-flash-tts`
(`GEMINI_TTS_MODEL`) mapped to same-gender voices, returned as WAV like Sarvam's. Responses
carry `provider` so logs/UI can tell which engine answered; every STT call logs a
`[STT] <engine> <lang> <KB> -> ...` line.

**Microphone diagnostics (`speechRecognition.ts`):** a recording whose speech-band level never
rises above `SILENT_MIC_RMS` shows "your microphone isn't picking up any sound" instead of
marking every word wrong (a real production report was exactly this: 1-2 KB of audio in 7 s —
real speech is ~16 KB/s), and an empty transcript asks the child to read louder. Live
(interim) checks run every 4 s (each re-sends the whole recording, billed per audio second)
and are skipped until the voice detector hears speech.

## Working on this repo (branch policy)

This repo has several long-lived branches under active independent development
(`master`, `working-branch-v2`, `BackEnd_Test`) plus `Pranay's-Branch`, which is the
integration branch actually being developed against day-to-day. **Do not push to any branch
other than the one you were explicitly told to work on.** When another branch gets new
commits, evaluate each change on its own merits before pulling it in — a same-named file
changing elsewhere does not mean it's an improvement (see this branch's OCR migration commit
for a concrete example: a same-day `working-branch-v2` commit added a PyMuPDF "native PDF
text" fast path to the old PaddleOCR service that reintroduces the exact embedded-text-trust
bug this migration exists to avoid — it was correctly left un-merged).

**`working-branch-v2` was merged into this branch** (see the merge commit's message for the
full file-by-file resolution). Short version: this branch's Docling+EasyOCR OCR pipeline and
Firestore `publishedReadings` publish pipeline were kept as-is (V2 never moved off PaddleOCR
and never persisted publishes server-side); V2's frontend navigation redesign (the
`StudentLibraryPage` → `SubjectStoriesPage` "Subject Hub" flow, `Navbar.tsx`, `LoginPage.tsx`)
and its `speechRecognition.ts`/`speechSynthesis.ts` accuracy fixes were adopted. The Published
Readings UI now lives in `SubjectStoriesPage.tsx` (filtered by subject + grade), not
`StudentLibraryPage.tsx`, since stories are no longer listed on that page directly.
A later V2 push (30 Sep: GSAP login pill, no navbar on `/login`) was merged the same way; its
`backend/ocr/main.py` change (PaddleOCR + Tesseract) was again left out.

**Where a published reading shows up for a student:** under the Subject Hub tile
(`HUB_SUBJECTS` in `publishedReadingToStory.ts`: English/Maths/Science/Social/Hindi/Telugu)
for the student's grade. The teacher picks the tile when publishing (`TextbookOCRModal.tsx`,
defaulted by `hubSubjectForReading()` from the AI-detected subject/language);
`SubjectStoriesPage.tsx` fetches by grade only and matches subjects with the same function, so
older readings saved with AI labels like "Environmental Studies" still land on a tile.

## No sample data (real accounts, empty data)

All sample content was removed: `src/data/studentsData.ts`, `classesData.ts` and
`defaultStories.ts` are empty; `schoolsData.ts` keeps only the school the seeded accounts
belong to (counts 0); `facultyData.ts` keeps the 4 faculty **accounts** (seed data only — each teacher signs in with their
own school email + password, remembered on the device as `ps_last_faculty_email`) with zeroed counts. `offlineStorage.ts` no longer seeds
students/classes/logs/audit entries, and `purgeSampleData()` (keyed by `DATA_VERSION`) wipes
what older builds cached in each browser's localStorage once, keeping teacher-created stories.
A student's record is created blank on login (`createBlankStudent` / `signInStudent`, from
`App.tsx`'s auth subscription) — previously the demo student silently showed another sample
student's stats. `/api/superadmin/telemetry` returns only real values (in-memory counters since
restart + Firestore counts, `null` when unreachable) and the SuperAdmin page shows "—"
instead of inventing numbers. Firestore itself still holds the seed script's `students`/
`classes`/extra `schools` docs; nothing in the app reads them, and they were left in place.

## End-to-end testing recipe

Run `npm run build` and `node dist/server.cjs` with `NODE_ENV=production`, then drive it with
Playwright (`/opt/node22/lib/node_modules/playwright`, Chromium at `/opt/pw-browsers/chromium`).
For read-aloud, launch Chromium with `--use-fake-device-for-media-stream
--use-file-for-fake-audio-capture=<speech.wav>%noloop` (make the WAV with Gemini TTS). In a
sandbox whose egress proxy Chromium can't CONNECT through, relay `googleapis.com` /
`firebaseapp.com` requests via `context.route()` + Node `fetch`. Faculty/admin password is
`FIREBASE_SEED_PASSWORD`; students sign in with class + roll number (e.g. Class 5, roll 17 = Arjun
Kumar). For API tests, exchange the custom token from `/api/auth/student-login` for an ID token
with Identity Toolkit's `accounts:signInWithCustomToken`. Reset any test activity afterwards —
the class dashboard shows everything in `readingSessions`/`wordPractice`.

## Known non-blocking inconsistencies

- `src/types.ts`'s `SarvamNeuralVoiceId` union lists far more voice names than `server.ts`'s
  actual speaker map supports — the type is permissive (`| (string & {})`), so this doesn't
  break anything, but a name accepted by the type isn't guaranteed to be a real voice.
