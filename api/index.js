// Vercel serverless entry: every /api/* request is rewritten here (vercel.json)
// and handled by the same Express app that server.ts runs locally. It loads
// the CommonJS bundle `npm run build` writes (dist/server.cjs), so the API
// runs exactly the code that was type-checked and bundled.
import server from "../dist/server.cjs";

export default server.default;
