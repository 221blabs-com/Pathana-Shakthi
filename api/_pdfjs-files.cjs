// Never called at runtime: names pdf.js's data folders for Vercel's file
// tracer (see api/index.js). The underscore keeps Vercel from making this
// file a function of its own.
const fs = require("fs");
const path = require("path");

module.exports = (name) => [
  fs.readFileSync(path.join(__dirname, "../node_modules/pdfjs-dist/cmaps", name)),
  fs.readFileSync(path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts", name)),
  fs.readFileSync(path.join(__dirname, "../node_modules/pdfjs-dist/wasm", name)),
  fs.readFileSync(path.join(__dirname, "../node_modules/pdfjs-dist/iccs", name)),
];
