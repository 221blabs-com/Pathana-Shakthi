// "Ask Shakthi Mitra" for teachers: an assistant that answers from the
// class's real data — every child's level, reading numbers, support group,
// open questions and competencies, the next chapters — with classroom-ready,
// FLN/SCERT-aligned advice. First names only; nothing is stored.
import { Router, Response } from "express";
import type { Query } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { studentView, todayKey, VALID_GRADES } from "./studentRoutes";
import { rateLimit } from "./security";
import { loadClassData } from "./supportRoutes";
import { supportFor } from "./classSupport";
import { competenciesFor, competencyStatus, STATUS_INFO } from "../src/data/competencies";
import { nextChapters } from "./dayPlan";

type Generate = (prompt: string, options?: { temperature?: number; format?: unknown; timeoutMs?: number; interactive?: boolean }) => Promise<{ text: string; model: string }>;

const SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" }, followUps: { type: "array", items: { type: "string" } } },
  required: ["answer", "followUps"],
};

export function buildTeacherMitraPrompt(input: {
  grade: string;
  question: string;
  history: { q: string; a: string }[];
  children: string[];
  competencies: string[];
  chapters: string[];
}) {
  return `You are Shakthi Mitra, a practical assistant for a government school teacher in Telangana, India, teaching ${input.grade} (often a multi-grade, multi-level classroom with few materials).
Answer the teacher's question using the class data below. Be concrete and classroom-ready: name children (first names only, only from the data), say what to do, for how long, with which materials (things a rural school has: chalk, slate, stones, sticks, paper, the app on one phone). Align advice with Foundational Literacy and Numeracy (NIPUN Bharat), Oral Reading Fluency and SCERT Telangana learning outcomes, and with multi-level grouping (beginner / developing / proficient).
If the data does not answer the question, say so briefly and give general good practice. Keep the answer under 170 words, in simple English, using short bullet points ("- "). Do not invent numbers or children.
Then give 2-3 short follow-up questions the teacher might ask next.

CLASS DATA (${input.grade}, ${todayKey()}):
Children (first name · reading level · readings · accuracy · words/min · support group · open question · competencies not achieved):
${input.children.join("\n") || "- no children yet"}

Competencies (achieved / total):
${input.competencies.join("\n") || "- none"}

Next chapters to teach (published by the teacher):
${input.chapters.join("\n") || "- no chapters published yet"}
${input.history.length ? `\nEARLIER IN THIS CONVERSATION:\n${input.history.map((h) => `Teacher: ${h.q}\nMitra: ${h.a}`).join("\n")}` : ""}

TEACHER'S QUESTION: ${input.question}`;
}

export function createTeacherMitraRouter(generate: Generate) {
  const router = Router();
  router.post(
    "/class/:grade/ask",
    requireFirebaseUser,
    requireRole(["faculty", "admin", "superadmin"]),
    rateLimit("teacher-mitra", 10, 60_000),
    async (req: AuthenticatedRequest, res: Response) => {
      const grade = String(req.params.grade);
      if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
      const question = String(req.body?.question || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 500);
      if (question.length < 3) return res.status(400).json({ error: "Type a question." });
      const history = (Array.isArray(req.body?.history) ? req.body.history : [])
        .slice(-3)
        .map((h: any) => ({ q: String(h?.q || "").slice(0, 300), a: String(h?.a || "").slice(0, 600) }));
      const started = Date.now();
      try {
        const { db } = getFirebaseAdmin();
        const school = req.appUser?.role === "superadmin" ? null : req.appUser?.schoolId || null;
        let rq: Query = db.collection("publishedReadings").where("grade", "==", grade);
        if (school) rq = rq.where("schoolId", "==", school);
        const [{ students, units }, readingSnap] = await Promise.all([
          loadClassData(req, grade),
          rq.select("bookId", "bookTitle", "chapterTitle", "chapterOrder", "subject").limit(500).get(),
        ]);
        const list = competenciesFor(grade);
        const today = todayKey();
        const views = students.map((d) => studentView(d.id, d.data()));
        const statuses = new Map(views.map((v) => [v.id, Object.fromEntries(list.map((c) => [c.id, competencyStatus(c, { ...v, units: units.get(v.id) || [] }, grade)]))]));
        const children = views
          .sort((a, b) => Number(a.rollNumber) - Number(b.rollNumber))
          .map((v) => {
            const support = supportFor(v, units.get(v.id) || [], today);
            const gaps = list.filter((c) => statuses.get(v.id)?.[c.id] !== "achieved").map((c) => c.short);
            const q = support.questions[0]?.question;
            return `- ${String(v.name).split(" ")[0]} · ${v.readingLevel} · ${v.sessionsCount} · ${v.sessionsCount ? `${v.overallAccuracy}%` : "-"} · ${v.averageWPM || "-"} · ${support.status.replace("_", " ")}${q ? ` · asked "${q.slice(0, 80)}"` : ""} · ${gaps.join(", ") || "all achieved"}`;
          });
        const competencies = list.map((c) => {
          const achieved = views.filter((v) => statuses.get(v.id)?.[c.id] === "achieved").length;
          const beginning = views.filter((v) => statuses.get(v.id)?.[c.id] === "beginning").length;
          return `- ${c.short} (${c.framework}): ${achieved}/${views.length} ${STATUS_INFO.achieved.name.toLowerCase()}, ${beginning} beginning`;
        });
        const chapters = nextChapters(
          readingSnap.docs.map((r) => {
            const x = r.data();
            return { id: r.id, bookKey: x.bookId || `title:${x.bookTitle}`, bookTitle: x.bookTitle || "", chapterTitle: x.chapterTitle || "", chapterOrder: Number(x.chapterOrder) || 0, subject: x.subject || "" };
          }),
          views.map((v) => ({ completedStoryIds: v.completedStoryIds })) as any
        ).map((n) => `- ${n.subject}: ${n.chapterTitle} (${n.bookTitle}), read by ${n.readBy}`);
        const prompt = buildTeacherMitraPrompt({ grade, question, history, children, competencies, chapters });
        const { text } = await generate(prompt, { temperature: 0.4, format: SCHEMA, timeoutMs: 45_000, interactive: true });
        const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        const answer = String(raw.answer || "").trim().slice(0, 2000);
        if (!answer) throw new Error("empty answer");
        console.log(`[TEACHER-MITRA] ${req.appUser?.role} ${grade} -> ${Date.now() - started}ms`);
        return res.json({
          answer,
          followUps: (Array.isArray(raw.followUps) ? raw.followUps : []).map((x: unknown) => String(x).slice(0, 120)).filter(Boolean).slice(0, 3),
        });
      } catch (error: any) {
        console.error("Teacher Mitra error:", error?.message || error);
        return res.status(502).json({ error: "Shakthi Mitra could not answer right now. Please try again in a minute." });
      }
    }
  );
  return router;
}
