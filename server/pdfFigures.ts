// Cuts pictures out of rendered PDF pages. The Gemini OCR fallback cannot
// return image crops, only where a picture is ([ymin, xmin, ymax, xmax] on a
// 0-1000 grid); for pages with no embedded JPEG to copy (scanned books,
// vector drawings) this renders the page with pdf.js and crops those boxes,
// so a scanned textbook's pictures reach the student instead of being lost.
import path from "path";
import { createRequire } from "module";
import type { DetectedChapterImage } from "./textbookOcr";

export interface FigureBox {
  pageNumber: number;
  box: number[];
  description: string;
}

const RENDER_LONG_SIDE = 1600;
const JPEG_QUALITY = 82;
const MAX_JPEG_BYTES = 700 * 1024;
const MIN_SIDE_PX = 90;
const MAX_FIGURES_PER_BOOK = 80;

// The crop rectangle in pixels for a 0-1000 box on a width x height page,
// padded slightly (OCR boxes are tight), or null for a box that is invalid,
// too small to be a picture, or the whole page (a scan, not a picture).
export function figureCropRect(
  box: number[],
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  if (!Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    return null;
  }
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)));
  if (ymax <= ymin || xmax <= xmin) return null;
  const areaShare = ((ymax - ymin) * (xmax - xmin)) / 1_000_000;
  if (areaShare > 0.85) return null;
  const pad = 8;
  const x = Math.max(0, Math.floor((xmin / 1000) * width) - pad);
  const y = Math.max(0, Math.floor((ymin / 1000) * height) - pad);
  const right = Math.min(width, Math.ceil((xmax / 1000) * width) + pad);
  const bottom = Math.min(height, Math.ceil((ymax / 1000) * height) + pad);
  const w = right - x;
  const h = bottom - y;
  if (w < MIN_SIDE_PX || h < MIN_SIDE_PX) return null;
  return { x, y, w, h };
}

// esbuild bundles the server as CommonJS and would turn import() into
// require(), which cannot load pdf.js's ES module build.
const importModule = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<any>;

/** True when (almost) every sampled pixel is near-white. */
export function isBlank(rgba: Uint8ClampedArray | Uint8Array, step = 16): boolean {
  let samples = 0;
  let inked = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4 * step) {
    samples += 1;
    if (Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) < 235) inked += 1;
  }
  return samples === 0 || inked / samples < 0.01;
}

export async function cropPdfFigures(
  pdfData: Uint8Array,
  figures: FigureBox[]
): Promise<Map<number, DetectedChapterImage[]>> {
  const byPage = new Map<number, DetectedChapterImage[]>();
  const wanted = figures.slice(0, MAX_FIGURES_PER_BOOK);
  if (wanted.length === 0) return byPage;

  const pdfjs = await importModule("pdfjs-dist/legacy/build/pdf.mjs");
  // Resolved from the app root: works both bundled (CommonJS) and under tsx (ESM).
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfData),
    standardFontDataUrl: `${root}/standard_fonts/`,
    cMapUrl: `${root}/cmaps/`,
    cMapPacked: true,
    // Scanned books often store pages as JBig2/JPEG2000 images; without the
    // decoders pdf.js skips those images and the crops come out blank.
    wasmUrl: `${root}/wasm/`,
    iccUrl: `${root}/iccs/`,
    isEvalSupported: false,
  }).promise;

  try {
    const pages = [...new Set(wanted.map((f) => f.pageNumber))].sort((a, b) => a - b);
    for (const pageNumber of pages) {
      if (pageNumber < 1 || pageNumber > doc.numPages) continue;
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_LONG_SIDE / Math.max(base.width, base.height) });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const full = doc.canvasFactory.create(width, height);
      await page.render({ canvas: full.canvas, canvasContext: full.context, viewport }).promise;

      for (const figure of wanted.filter((f) => f.pageNumber === pageNumber)) {
        const rect = figureCropRect(figure.box, width, height);
        if (!rect) continue;
        const crop = doc.canvasFactory.create(rect.w, rect.h);
        crop.context.drawImage(full.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        // An empty (all-white) crop means the picture didn't render: skip it
        // rather than publishing a blank picture.
        if (isBlank(crop.context.getImageData(0, 0, rect.w, rect.h).data)) {
          doc.canvasFactory.destroy(crop);
          continue;
        }
        let jpeg: Buffer = await crop.canvas.encode("jpeg", JPEG_QUALITY);
        if (jpeg.length > MAX_JPEG_BYTES) jpeg = await crop.canvas.encode("jpeg", 60);
        doc.canvasFactory.destroy(crop);
        if (jpeg.length > MAX_JPEG_BYTES) continue;
        const list = byPage.get(pageNumber) || [];
        list.push({
          base64: jpeg.toString("base64"),
          mimeType: "image/jpeg",
          pageNumber,
          caption: figure.description.trim(),
        });
        byPage.set(pageNumber, list);
      }
      doc.canvasFactory.destroy(full);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return byPage;
}
