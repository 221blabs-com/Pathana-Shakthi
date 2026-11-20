// Pictures a teacher's browser sends for a published chapter are stored as
// base64 in Firestore and later shown to children as `data:` URLs. Only real
// JPEG/PNG/WebP pictures that fit a Firestore document are kept.
const MAX_BASE64_CHARS = 950_000; // Firestore's 1 MiB per document, with room for the other fields
const MIME_BY_MAGIC: Array<[string, (b: Buffer) => boolean]> = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP"],
];

export type StorableImage = { base64: string; mimeType: string; pageNumber: number | null; caption: string };

/** The picture as it should be stored, or null if it is not a real, small enough picture. */
export function storableImage(img: any): StorableImage | null {
  let base64 = typeof img?.base64 === "string" ? img.base64.trim() : "";
  const dataUrl = /^data:[^;,]+;base64,/.exec(base64);
  if (dataUrl) base64 = base64.slice(dataUrl[0].length);
  if (!base64 || base64.startsWith("ref:") || base64.length > MAX_BASE64_CHARS) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const head = Buffer.from(base64.slice(0, 24), "base64");
  const kind = MIME_BY_MAGIC.find(([, test]) => test(head));
  if (!kind) return null;
  const page = Number(img?.pageNumber);
  return {
    base64,
    mimeType: kind[0], // what the bytes are, not what the request said
    pageNumber: Number.isInteger(page) && page > 0 && page < 100_000 ? page : null,
    caption: String(img?.caption ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 500),
  };
}
