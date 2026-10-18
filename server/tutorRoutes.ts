// "Ask Shakthi Mitra": the AI part of the tutor. A child asks about what is
// on screen (the reader page, a Learn & Play card, a dictionary word) and gets
// a short, simple, grounded answer and a few next questions to tap. Answers
// are kept to learning topics, in English unless the child asks in Telugu or
// Hindi, and every child has a daily cap. Questions are not stored.
import { Router } from "express";
import { AuthenticatedRequest, requireFirebaseUser, requireProfile } from "./firebaseRoutes";
import { rateLimit } from "./security";
import { scriptLanguage } from "./textbookOcr";

type Generate = (prompt: string, options?: { temperature?: number; format?: unknown; timeoutMs?: number; interactive?: boolean }) => Promise<{ text: string; model: string }>;

const DAILY_LIMIT = Number(process.env.TUTOR_DAILY_LIMIT || 80);
const used = new Map<string, number>();

const clip = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    followUps: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "followUps"],
};

export function buildTutorPrompt(input: {
  grade: string;
  question: string;
  kind: string;
  title?: string;
  text?: string;
  word?: string;
  answerLanguage: string;
}): string {
  const context = [
    input.title ? `Title: ${input.title}` : "",
    input.word ? `The word the child is looking at: "${input.word}"` : "",
    input.text ? `What is on the child's screen:\n"""\n${input.text}\n"""` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `You are Shakthi Mitra, a warm, patient reading tutor (a friendly tiger) for a ${input.grade} child in an Indian government school.

Rules:
- Answer in ${input.answerLanguage}, in very simple words a ${input.grade} child understands: at most 3 short sentences, under 60 words.
- Help only with learning: reading, words, meanings, spelling, pronunciation, the story or lesson on screen, and school subjects.
- When the question is about the text on screen, answer from that text. If the answer is not in it, say so kindly and give what help you can.
- To help pronounce a word, split it into syllables with hyphens (e.g. "bas-ket") and give a simple sounds-like hint.
- If asked to "quiz me", ask ONE simple question about the text and do not give the answer.
- Never ask for or repeat personal details (full name, address, phone, school). Never talk about violence, adult topics, or anything unsafe; gently bring the child back to learning.
- Be encouraging. No emojis except at most one at the end.
- followUps: 2 or 3 very short questions (under 8 words each) this child might want to ask next, in ${input.answerLanguage}.

${context || "The child is on their home page."}

The child asks: "${input.question}"

Return JSON: {"answer": "...", "followUps": ["...", "..."]}`;
}

export function createTutorRouter(generate: Generate) {
  const router = Router();

  router.post(
    "/tutor/ask",
    requireFirebaseUser,
    requireProfile,
    rateLimit("tutor", 12, 60_000),
    async (req: AuthenticatedRequest, res) => {
      const question = clip(req.body?.question, 300);
      if (question.length < 2) return res.status(400).json({ error: "Ask Shakthi Mitra a question." });
      const uid = String(req.firebaseUser?.uid || "");
      const key = `${uid}:${new Date().toISOString().slice(0, 10)}`;
      const count = used.get(key) || 0;
      if (count >= DAILY_LIMIT) {
        return res.status(429).json({ error: "Shakthi Mitra needs a rest! Ask again tomorrow." });
      }
      used.set(key, count + 1);
      if (used.size > 20_000) used.delete(used.keys().next().value as string);

      const ctx = req.body?.context || {};
      const grade = clip(req.appUser?.grade, 20) || "Class 3";
      // English unless the child writes in Telugu or Hindi script.
      const asked = scriptLanguage(question);
      const answerLanguage =
        asked === "Telugu" ? "Telugu (Telugu script)" : asked === "Hindi" ? "Hindi (Devanagari script)" : "simple English";
      const started = Date.now();
      try {
        const { text } = await generate(
          buildTutorPrompt({
            grade,
            question,
            kind: clip(ctx.kind, 20),
            title: clip(ctx.title, 160),
            text: clip(ctx.text, 2500),
            word: clip(ctx.word, 40),
            answerLanguage,
          }),
          { temperature: 0.4, format: REPLY_SCHEMA, timeoutMs: 30_000, interactive: true }
        );
        const parsed = JSON.parse(String(text).replace(/^```(?:json)?|```$/g, "").trim());
        const answer = clip(parsed?.answer, 700);
        if (!answer) throw new Error("empty answer");
        const followUps = (Array.isArray(parsed?.followUps) ? parsed.followUps : [])
          .map((f: unknown) => clip(f, 80))
          .filter(Boolean)
          .slice(0, 3);
        console.log(`[TUTOR] ${req.appUser?.role || "?"} ${grade} ${clip(ctx.kind, 20) || "home"} -> ${Date.now() - started}ms`);
        return res.json({ answer, followUps });
      } catch (error: any) {
        used.set(key, count); // a failed answer doesn't count
        console.error("[TUTOR] failed:", error?.message || error);
        return res.status(503).json({ error: "Shakthi Mitra is thinking too hard right now. Please try again!" });
      }
    }
  );

  return router;
}
