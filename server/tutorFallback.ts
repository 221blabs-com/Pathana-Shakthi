// "Ask Shakthi Mitra" without the AI: answers the questions the tutor itself
// suggests (meaning of a word, how to say it, use it in a sentence, explain
// this page, quiz me, key ideas, a new word) from the built-in dictionary and
// the text on screen. Shorter than the AI's answers, but a child who taps a
// suggestion always gets help instead of "try again".
import { DICTIONARY_WORDS } from "../src/data/dictionary";

export type TutorInput = { question: string; grade?: string; title?: string; text?: string; word?: string };
export type TutorReply = { answer: string; followUps: string[]; source: "text" };

const sentencesOf = (text: string) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।॥])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(" ").length >= 3);

// "A small place." → "a small place" (to follow "means"), keeping acronyms like "TV".
const asPhrase = (meaning: string) => {
  const m = String(meaning || "").trim().replace(/\.$/, "");
  return /^[A-Z](?![A-Z])/.test(m) ? m[0].toLowerCase() + m.slice(1) : m;
};

const wordsOf = (text: string) => String(text || "").match(/[\p{L}\p{M}']+/gu) || [];

function quotedWord(question: string, fallback?: string): string {
  const q = /["“'‘]([^"”'’]{1,40})["”'’]/.exec(question);
  return (q?.[1] || fallback || "").trim();
}

function lookUp(word: string) {
  const w = word.toLowerCase();
  return (
    DICTIONARY_WORDS.find((d) => d.word.toLowerCase() === w) ||
    DICTIONARY_WORDS.find((d) => d.word.toLowerCase() === w.replace(/(es|s)$/, "")) ||
    null
  );
}

/** "basket" → "bas-ket": a reading aid (vowel groups), not a dictionary syllabification. */
export function syllables(word: string): string {
  if (!/^[a-z']+$/i.test(word) || word.length <= 4) return word;
  const parts = word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]))?/gi) || [word];
  const joined = parts.join("");
  const tail = word.slice(joined.length);
  if (tail) parts[parts.length - 1] += tail;
  return parts.join("-");
}

export function textTutorAnswer(input: TutorInput): TutorReply {
  const q = input.question.toLowerCase();
  const word = quotedWord(input.question, input.word);
  const sentences = sentencesOf(input.text || "");
  const reply = (answer: string, followUps: string[]): TutorReply => ({ answer, followUps: followUps.slice(0, 3), source: "text" });

  if (word && /(mean|meaning|అర్థం|मतलब|अर्थ)/i.test(q)) {
    const hit = lookUp(word);
    if (hit) return reply(`"${hit.word}" means ${asPhrase(hit.meaning)}. ${hit.emoji}`, [`How do I say "${hit.word}"?`, `Use "${hit.word}" in a sentence`]);
    const used = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()));
    return reply(
      used ? `Look at how "${word}" is used: "${used}" Read the sentence again and guess what it means, then ask your teacher.` : `I don't know "${word}" yet. Look for it in the Word Dictionary, or ask your teacher.`,
      [`How do I say "${word}"?`, "Quiz me on this page"]
    );
  }
  if (word && /(say|pronounce|how do i say|help me say|ఉచ్చరించ|बोल)/i.test(q)) {
    const hit = lookUp(word);
    const sounds = hit?.sounds ? ` It sounds like "${hit.sounds}".` : "";
    return reply(`Say it slowly: ${syllables(word)}.${sounds} Tap the word to hear it, then say it back.`, [`What does "${word}" mean?`]);
  }
  if (word && /sentence/i.test(q)) {
    const hit = lookUp(word);
    const used = hit?.example || sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()));
    if (used) return reply(`Here is a sentence: "${used}" Now make your own sentence with "${word}".`, [`What does "${word}" mean?`]);
  }
  if (/quiz/i.test(q) && sentences.length) {
    const s = sentences[Math.min(sentences.length - 1, Math.floor(sentences.length / 2))];
    const longest = wordsOf(s).sort((a, b) => b.length - a.length)[0];
    if (longest) return reply(`Which word is missing? "${s.replace(longest, "_____")}"`, ["Explain this page simply"]);
  }
  if (/(explain|key ideas|what is this|about)/i.test(q) && sentences.length) {
    const lead = sentences.slice(0, 2).join(" ");
    return reply(`${input.title ? `"${input.title}": ` : ""}${lead} Read it once more slowly, and tap any word you don't know.`, ["Quiz me on this page"]);
  }
  if (/new word/i.test(q)) {
    const grade = Number(String(input.grade || "").replace(/\D/g, "")) || 3;
    const pool = DICTIONARY_WORDS.filter((d) => d.language === "English" && d.grades[0] <= grade && grade <= d.grades[1]);
    const pick = pool[new Date().getDate() % Math.max(1, pool.length)];
    if (pick) return reply(`Today's word is "${pick.word}" ${pick.emoji}. It means ${asPhrase(pick.meaning)}.`, [`How do I say "${pick.word}"?`]);
  }
  if (/read better/i.test(q)) {
    return reply("Read a little every day. First listen, then read aloud slowly, and point to each word. Practise the words you find hard in the Word Dictionary.", ["Give me a new word to learn"]);
  }
  return reply("I can't think of a full answer right now. Read the page again slowly, tap the words you don't know, and ask your teacher too!", [
    "Explain this page simply",
    "Give me a new word to learn",
  ]);
}
