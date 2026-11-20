import { test } from "node:test";
import assert from "node:assert/strict";
import { syllables, textTutorAnswer } from "./tutorFallback";
import { buildTextClassPlan } from "./classRoutes";

const page = "A crow was very thirsty. It flew over the village looking for water. At last it saw a pot.";

test("tutor without AI: meaning, saying, quiz and explain come from the dictionary and the page", () => {
  assert.match(textTutorAnswer({ question: 'What does "village" mean?', text: page }).answer, /village" means a small/);
  assert.match(textTutorAnswer({ question: 'Help me say "thirsty"', text: page }).answer, /thir-sty|thirs-ty/);
  const quiz = textTutorAnswer({ question: "Quiz me on this page", text: page }).answer;
  assert.match(quiz, /_____/);
  assert.match(textTutorAnswer({ question: "Explain this page simply", text: page, title: "The Clever Crow" }).answer, /The Clever Crow/);
  assert.match(textTutorAnswer({ question: 'What does "zzqx" mean?', text: page }).answer, /don't know "zzqx"/);
  const any = textTutorAnswer({ question: "Tell me a fun fact" });
  assert.ok(any.answer.length > 10 && any.followUps.length > 0);
});

test("syllables split long English words and leave short ones", () => {
  assert.equal(syllables("basket"), "bas-ket");
  assert.equal(syllables("cat"), "cat");
  assert.equal(syllables("పిల్లి"), "పిల్లి");
});

test("week plan without AI groups children from the class's own numbers", () => {
  const today = new Date("2026-11-20T10:00:00Z");
  const plan = buildTextClassPlan(
    {
      grade: "Class 3",
      students: [
        { name: "Ravi Teja", sessionsCount: 4, overallAccuracy: 45, lastActiveDate: "2026-11-19", readingLevel: "developing" },
        { name: "Sita Rao", sessionsCount: 0, overallAccuracy: 0, lastActiveDate: "", readingLevel: "beginner" },
        { name: "Imran Khan", sessionsCount: 6, overallAccuracy: 92, lastActiveDate: "2026-11-20", readingLevel: "proficient" },
      ],
      struggledWords: [{ word: "thirsty" }],
    },
    today
  );
  assert.equal(plan.source, "text");
  assert.deepEqual(plan.actions.find((a) => /beginners/.test(a.title))?.students, ["Sita"]);
  assert.deepEqual(plan.actions.find((a) => /under 60%/.test(a.title))?.students, ["Ravi"]);
  assert.ok(plan.actions.length <= 4);
  assert.deepEqual(plan.wordsToPractise, ["thirsty"]);
  assert.match(plan.summary, /2 of 3 children/);
  const empty = buildTextClassPlan({ grade: "Class 1", students: [{ name: "A B", sessionsCount: 0, overallAccuracy: 0 }], struggledWords: [] }, today);
  assert.match(empty.summary, /No child/);
});

test("agent without AI answers from the class summary", async () => {
  const { classSummaryAnswer } = await import("./teacherAgent");
  const text = classSummaryAnswer(
    {
      grade: "Class 5",
      children: [
        { name: "Ravi Teja", group: "need_help", openQuestion: "What is a pot? — The Clever Crow", readings: 3, lastActive: "2026-11-19" },
        { name: "Sita Rao", group: "go_ahead", readings: 0, lastActive: "never" },
        { name: "Imran Khan", group: "very_good", readings: 5, lastActive: "2026-11-01" },
      ],
      nextChapters: [{ chapterTitle: "The Lazy Lion" }],
      focus: ["Comprehension"],
    },
    "2026-11-20"
  );
  assert.match(text, /\*\*Need help:\*\* Ravi/);
  assert.match(text, /Questions waiting:\*\* Ravi \(What is a pot\?/);
  assert.match(text, /Not read in the app yet:\*\* Sita/);
  assert.match(text, /Not practised this week:\*\* Imran/);
  assert.match(text, /Next chapter to teach:\*\* The Lazy Lion/);
});
