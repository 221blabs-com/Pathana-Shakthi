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
                      (Sarvam TTS/STT wrappers), backendApi.ts.
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
npm run test:unit   # server/textbookOcr.test.ts — pure OCR-mapping logic, no server needed
npm run test:ocr    # backend/ocr/test_main.py — needs backend/ocr's deps installed
                     # (pip install -r backend/ocr/requirements.txt in whatever env/venv
                     # python3 resolves to); does NOT need the Hugging Face model download,
                     # it only exercises build_chapters()/picture_to_payload() against
                     # hand-built DoclingDocument objects, never DocumentConverter.convert()
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

### 3. OCR service (`backend/ocr/main.py`, port 8001) — **Docling**

As of this branch, OCR runs on **IBM Docling** (`docling` PyPI package), not PaddleOCR.
This replaced PaddleOCR because Docling's `force_full_page_ocr` avoids a specific failure
mode common to Indian-language textbook PDFs: legacy DTP fonts remap glyphs to arbitrary
Unicode code points, so trusting a PDF's embedded text layer (instead of always rendering +
OCRing every page) can silently produce confident-looking garbage text. Docling also extracts
embedded pictures per chapter (`generate_picture_images`), which PaddleOCR never did.

**Setup:**

```bash
# System dependency — Tesseract, with the three languages this app supports
apt-get install tesseract-ocr tesseract-ocr-tel tesseract-ocr-hin tesseract-ocr-eng
# (macOS: brew install tesseract tesseract-lang)

cd backend/ocr
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

**First run downloads Docling's layout model** (`docling-project/docling-layout-heron`) from
Hugging Face — a few hundred MB, one-time, then cached locally (`~/.cache/docling` /
`~/.cache/huggingface`). This needs a real internet connection to huggingface.co on first
run; after that it works fully offline. If you're behind a restrictive proxy/firewall that
blocks huggingface.co, the OCR service will start fine but every OCR job will fail with a
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
  "languagesUsed": ["tel", "hin", "eng"],
  "chapters": [
    {
      "heading": "Chapter 3: The Clever Crow",
      "pageNumber": 12,
      "paragraphs": ["...", "..."],
      "images": [
        { "base64": "...", "mimeType": "image/png", "pageNumber": 12, "caption": "..." }
      ]
    }
  ]
}
```

`server.ts`'s `chaptersFromDoclingResult()` reshapes this into the `DetectedChapter[]` shape
the rest of the pipeline (`analyzeChapterChunk`, `normalizeChapterResult`,
`buildFallbackChapterResult`) already expects — Ollama analysis and the chapter/paragraph/
image passthrough are otherwise unchanged from before the Docling migration.

**Language selection:** the teacher picks Telugu/Hindi/English in the OCR upload UI
(`TextbookOCRModal.tsx`); `server.ts`'s `OCR_LANGUAGE_CODE_MAP` sends the matching lowercase
word (`"telugu"|"hindi"|"english"`) to the OCR service, which maps it to Tesseract's 3-letter
codes in `TESSERACT_LANG_MAP` (`backend/ocr/main.py`). Tesseract uses ISO 639-2 codes
(`tel`/`hin`/`eng`), not BCP-47 — don't send `"te"/"hi"/"en"` directly to the OCR service.

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

## Known non-blocking inconsistencies

- `package.json` still lists `@google/genai` as a dependency even though Gemini usage was
  removed from `server.ts` in favor of Sarvam (voice) and Ollama (text generation). Harmless
  but worth pruning if you're touching `package.json` anyway.
- `src/types.ts`'s `SarvamNeuralVoiceId` union lists far more voice names than `server.ts`'s
  actual speaker map supports — the type is permissive (`| (string & {})`), so this doesn't
  break anything, but a name accepted by the type isn't guaranteed to be a real voice.
