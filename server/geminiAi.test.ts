// Unit tests for the Gemini OCR fallback's pure pieces — no network, no API
// key. Run with: npx tsx --test server/geminiAi.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  expandModelRoutes,
  extractPdfImages,
  parseGeminiKeys,
  parseModelChain,
  parseOcrPagesResponse,
  providerMode,
  splitModelRoute,
} from "./geminiAi";
import {
  chaptersFromDoclingResult,
  doclingChaptersFromOcrPages,
  extractChapterNumberAndTitle,
} from "./textbookOcr";

// Smallest valid baseline JPEGs pdf-lib accepts: SOI, a SOF0 header with the
// given size, EOI. Only the header matters for embedding/extraction.
function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

describe("providerMode", () => {
  test("defaults to auto and accepts local/gemini case-insensitively", () => {
    assert.equal(providerMode(undefined), "auto");
    assert.equal(providerMode("GEMINI"), "gemini");
    assert.equal(providerMode(" local "), "local");
    assert.equal(providerMode("docling"), "auto");
  });
});

describe("parseModelChain", () => {
  test("splits a comma list and falls back to defaults when empty", () => {
    assert.deepEqual(parseModelChain("a, b ,,c"), ["a", "b", "c"]);
    assert.ok(parseModelChain("").length > 0);
  });
});

describe("parseOcrPagesResponse", () => {
  test("offsets pageIndex by the chunk's first page and drops empty blocks", () => {
    const pages = parseOcrPagesResponse(
      JSON.stringify({
        pages: [
          { pageIndex: 1, blocks: [{ kind: "paragraph", text: "a" }, { kind: "paragraph", text: "  " }] },
          { pageIndex: 2, blocks: [] },
        ],
      }),
      9,
      2
    );
    assert.deepEqual(pages, [
      { pageNumber: 9, blocks: [{ kind: "paragraph", text: "a" }] },
      { pageNumber: 10, blocks: [] },
    ]);
  });

  test("clamps an out-of-range pageIndex into the chunk", () => {
    const pages = parseOcrPagesResponse(
      JSON.stringify({ pages: [{ pageIndex: 7, blocks: [] }] }),
      1,
      4
    );
    assert.equal(pages[0].pageNumber, 4);
  });

  test("throws on non-JSON so the caller can retry page by page", () => {
    assert.throws(() => parseOcrPagesResponse("{\"pages\": [", 1, 2));
  });
});

describe("doclingChaptersFromOcrPages", () => {
  test("starts a chapter per lesson heading, across page boundaries", () => {
    const chapters = doclingChaptersFromOcrPages([
      { pageNumber: 1, blocks: [
        { kind: "chapter_heading", text: "పాఠం 1: చెరువు" },
        { kind: "paragraph", text: "p1" },
      ] },
      { pageNumber: 2, blocks: [
        { kind: "paragraph", text: "p2" },
        { kind: "table", text: "| a |\n|---|\n| 1 |" },
        { kind: "chapter_heading", text: "పాఠం 2: చిలుక" },
        { kind: "subheading", text: "అభ్యాసాలు" },
      ] },
    ]);
    assert.equal(chapters.length, 2);
    assert.deepEqual(chapters[0].paragraphs, ["p1", "p2"]);
    assert.equal(chapters[0].tables[0].pageNumber, 2);
    assert.equal(chapters[1].pageNumber, 2);
    assert.deepEqual(chapters[1].paragraphs, ["అభ్యాసాలు"]);
  });

  test("keeps text before the first heading in its own untitled section", () => {
    const chapters = doclingChaptersFromOcrPages([
      { pageNumber: 1, blocks: [{ kind: "paragraph", text: "preface" }] },
      { pageNumber: 2, blocks: [{ kind: "chapter_heading", text: "Lesson 1" }, { kind: "paragraph", text: "x" }] },
    ]);
    assert.equal(chapters[0].heading, "");
    assert.deepEqual(chapters[0].paragraphs, ["preface"]);
  });

  test("merges a heading split over two lines", () => {
    const chapters = doclingChaptersFromOcrPages([
      { pageNumber: 3, blocks: [
        { kind: "chapter_heading", text: "Lesson 3" },
        { kind: "chapter_heading", text: "The Clever Crow" },
        { kind: "paragraph", text: "x" },
      ] },
    ]);
    assert.equal(chapters.length, 1);
    assert.equal(chapters[0].heading, "Lesson 3 The Clever Crow");
  });

  test("attaches a page's pictures to the lesson starting on it and matches captions", () => {
    const image = { base64: "AAA", mimeType: "image/jpeg", pageNumber: 2, caption: "" };
    const chapters = doclingChaptersFromOcrPages(
      [
        { pageNumber: 1, blocks: [{ kind: "chapter_heading", text: "L1" }, { kind: "paragraph", text: "a" }] },
        { pageNumber: 2, blocks: [
          { kind: "paragraph", text: "end of L1" },
          { kind: "chapter_heading", text: "L2" },
          { kind: "caption", text: "Figure 1" },
          { kind: "caption", text: "extra caption" },
        ] },
      ],
      new Map([[2, [image]]])
    );
    assert.equal(chapters[0].images.length, 0);
    assert.equal(chapters[1].images.length, 1);
    assert.equal(chapters[1].images[0].caption, "Figure 1");
    assert.deepEqual(chapters[1].paragraphs, ["extra caption"]);
    assert.equal(image.caption, "", "input images are not mutated");
  });

  test("output flows through chaptersFromDoclingResult unchanged", () => {
    const detected = chaptersFromDoclingResult(
      doclingChaptersFromOcrPages([
        { pageNumber: 1, blocks: [{ kind: "chapter_heading", text: "Cover" }] },
        { pageNumber: 2, blocks: [{ kind: "chapter_heading", text: "Lesson 2: Seeds" }, { kind: "paragraph", text: "A seed grows." }] },
      ])
    );
    assert.equal(detected.length, 1, "an empty cover heading is dropped");
    assert.equal(detected[0].chapterNumber, "Lesson 2");
    assert.equal(detected[0].chapterTitle, "Seeds");
    assert.equal(detected[0].text, "A seed grows.");
  });
});

describe("extractChapterNumberAndTitle (Indic lesson words)", () => {
  test("parses Telugu and Hindi lesson numbers", () => {
    assert.deepEqual(extractChapterNumberAndTitle("పాఠం 1: మా ఊరి చెరువు"), {
      chapterNumber: "పాఠం 1",
      chapterTitle: "మా ఊరి చెరువు",
    });
    assert.deepEqual(extractChapterNumberAndTitle("पाठ 4 - तितली"), {
      chapterNumber: "पाठ 4",
      chapterTitle: "तितली",
    });
  });

  test("keeps an English title that merely starts with a lesson word whole", () => {
    assert.deepEqual(extractChapterNumberAndTitle("Poems & Verses"), {
      chapterNumber: "",
      chapterTitle: "Poems & Verses",
    });
    assert.equal(extractChapterNumberAndTitle("Lesson3: Rain").chapterNumber, "Lesson 3");
    assert.equal(extractChapterNumberAndTitle("Poem").chapterNumber, "Poem");
  });

  test("does not split an Indic title that merely starts with a lesson word", () => {
    assert.equal(extractChapterNumberAndTitle("కథలు చెప్పే తాత").chapterNumber, "");
  });
});

describe("extractPdfImages", () => {
  test("extracts an embedded illustration, skipping logos repeated on every page", async () => {
    const pdf = await PDFDocument.create();
    const illustration = await pdf.embedJpg(fakeJpeg(600, 400));
    const logo = await pdf.embedJpg(fakeJpeg(200, 200));
    for (let i = 0; i < 3; i++) {
      const page = pdf.addPage([595, 842]);
      page.drawImage(logo, { x: 500, y: 780, width: 40, height: 40 });
      if (i === 1) page.drawImage(illustration, { x: 50, y: 400, width: 300, height: 200 });
    }
    const loaded = await PDFDocument.load(await pdf.save());
    const images = extractPdfImages(loaded);
    assert.deepEqual([...images.keys()], [2]);
    const [image] = images.get(2)!;
    assert.equal(image.mimeType, "image/jpeg");
    assert.ok(Buffer.from(image.base64, "base64").subarray(0, 2).equals(Buffer.from([0xff, 0xd8])));
  });

  test("skips everything for a scanned book (one full-page image per page)", async () => {
    const pdf = await PDFDocument.create();
    const scan = await pdf.embedJpg(fakeJpeg(1240, 1754));
    for (let i = 0; i < 4; i++) {
      pdf.addPage([595, 842]).drawImage(scan, { x: 0, y: 0, width: 595, height: 842 });
    }
    const loaded = await PDFDocument.load(await pdf.save());
    assert.equal(extractPdfImages(loaded).size, 0);
  });
});

test("several Gemini keys: every key is tried on a model before the next model", () => {
  assert.deepEqual(parseGeminiKeys(" AQ.a, AQ.b\nAQ.c ,AQ.a"), ["AQ.a", "AQ.b", "AQ.c"]);
  assert.deepEqual(expandModelRoutes(["m1", "m2"], 1), ["m1", "m2"]);
  assert.deepEqual(expandModelRoutes(["m1", "m2"], 3), ["m1", "m1#2", "m1#3", "m2", "m2#2", "m2#3"]);
  assert.deepEqual(splitModelRoute("gemini-3.6-flash#3"), { model: "gemini-3.6-flash", keyIndex: 2 });
  assert.deepEqual(splitModelRoute("gemini-3.6-flash"), { model: "gemini-3.6-flash", keyIndex: 0 });
});
