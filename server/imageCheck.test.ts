import { test } from "node:test";
import assert from "node:assert/strict";
import { storableImage } from "./imageCheck";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]).toString("base64");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0]).toString("base64");

test("keeps JPEG and PNG, with the type taken from the bytes", () => {
  assert.equal(storableImage({ base64: jpeg, mimeType: "text/html" })?.mimeType, "image/jpeg");
  assert.equal(storableImage({ base64: png })?.mimeType, "image/png");
  assert.equal(storableImage({ base64: `data:image/png;base64,${png}` })?.base64, png);
});

test("drops placeholders, non-pictures, broken base64 and oversized pictures", () => {
  assert.equal(storableImage({ base64: "ref:3" }), null);
  assert.equal(storableImage({ base64: Buffer.from("<script>alert(1)</script>").toString("base64") }), null);
  assert.equal(storableImage({ base64: "not base64 !!" }), null);
  assert.equal(storableImage({ base64: jpeg + "A".repeat(950_001) }), null);
  assert.equal(storableImage({}), null);
  assert.equal(storableImage(null), null);
});

test("cleans page numbers and captions", () => {
  const img = storableImage({ base64: jpeg, pageNumber: "12", caption: "A crow\n drinking" });
  assert.equal(img?.pageNumber, 12);
  assert.equal(img?.caption, "A crow  drinking");
  assert.equal(storableImage({ base64: jpeg, pageNumber: -1 })?.pageNumber, null);
});
