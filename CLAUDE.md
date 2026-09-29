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
npm run test:unit   # server/textbookOcr.test.ts + src/services/publishedReadingToStory.test.ts —
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
  rather than silently missing.
- **Pictures:** Gemini can't return image crops, so `extractPdfImages()` copies embedded JPEG
  streams straight out of the PDF (a PDF JPEG stream is a complete JPEG file — no image
  library). It skips logos repeated on 3+ pages, CMYK/non-JPEG images, images over 700 KB
  (Firestore's 1 MiB/doc limit after base64), and **scanned books entirely** (≥50% of pages
  are one full-page image — extracting those would just duplicate the text as a photo).
  Scanned books therefore publish text-only through the fallback; the Docling path does crop
  pictures out of scans.
- **Models:** a comma-separated chain (`GEMINI_MODEL`, `GEMINI_OCR_MODEL`; default
  `gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.8-flash`). Measured on scanned Telugu pages:
  3.5-flash is the most faithful but often overloaded (503); 3.5-flash-lite is always up and
  fast (~6 s for 6 pages, ~96% exact words) but occasionally "normalizes" a colloquial
  spelling; 3.8-flash was almost always overloaded. `gemini-2.5-*` is retired for new keys
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
grouped 3-per-page (`StoryPage.text`); images and tables are attached to pages by index, and
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

## Voice (Sarvam AI)

TTS is Sarvam Bulbul v3, STT is Sarvam Saaras v4 — `SARVAM_API_KEY` in `.env`
(https://dashboard.sarvam.ai). Optional `SARVAM_PRONUNCIATION_DICT_ID` for a custom
pronunciation dictionary. Language codes are `te-IN`/`hi-IN`/`en-IN`; the speaker map
(priya/shubh/neha/ratan/ishita/suhani) is in `server.ts`'s speech routes.

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

**Where a published reading shows up for a student:** under the Subject Hub tile
(`HUB_SUBJECTS` in `publishedReadingToStory.ts`: English/Maths/Science/Social/Hindi/Telugu)
for the student's grade. The teacher picks the tile when publishing (`TextbookOCRModal.tsx`,
defaulted by `hubSubjectForReading()` from the AI-detected subject/language);
`SubjectStoriesPage.tsx` fetches by grade only and matches subjects with the same function, so
older readings saved with AI labels like "Environmental Studies" still land on a tile. The
student login in `LoginPage.tsx` is still `working-branch-v2`'s demo shortcut (fixed student
`PS20260017`, Class 5, no student-session backend call); it now also holds an **anonymous
Firebase session**, because `/api/readings` requires a Firebase ID token. With no `users` doc
behind that anonymous user, `/api/readings` isn't school-scoped for demo students.

## Known non-blocking inconsistencies

- `src/types.ts`'s `SarvamNeuralVoiceId` union lists far more voice names than `server.ts`'s
  actual speaker map supports — the type is permissive (`| (string & {})`), so this doesn't
  break anything, but a name accepted by the type isn't guaranteed to be a real voice.
- `FacultyPortalPage.tsx` still has a second, unwired "publish OCR as a story" path
  (`handleTextbookScanned`/`makeTextbookLessonStory`/`onAddStories`, from the
  `working-branch-v2` merge) that chunks raw OCR text into a `Story` and saves it to
  `localStorage` via `offlineStorage.addCustomStories` — a cruder duplicate of the real
  `POST /api/readings/publish` flow (`TextbookOCRModal.tsx`'s "Publish to {grade}" button):
  no real quiz, no images/tables, no cross-device sync. It's currently dead code (nothing
  calls `handleTextbookScanned`), kept rather than deleted during the merge. Worth removing
  outright, or wiring it to something else, next time you're in this file — don't let a
  teacher discover two different "publish" buttons that do different things.
