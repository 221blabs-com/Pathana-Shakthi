// Vercel serverless entry: every /api/* request is rewritten here (vercel.json)
// and handled by the same Express app that server.ts runs locally. It loads
// the CommonJS bundle `npm run build` writes (dist/server.cjs), so the API
// runs exactly the code that was type-checked and bundled.
import server from "../dist/server.cjs";

// A function only gets the files Vercel's tracer can see. pdf.js (picture
// crops and damaged PDFs, server/pdfFigures.ts) is loaded with a runtime
// import() and reads its data folders by computed paths, so this block —
// which never runs — names them for the tracer. (vercel.json includeFiles
// is not applied to this function.)
if (process.env.PATHANA_TRACE_ONLY === "1") {
  await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  await import("@napi-rs/canvas");
  (await import("./_pdfjs-files.cjs")).default(process.env.PATHANA_TRACE_ONLY);
}

export default server.default;
