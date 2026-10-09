import test from "node:test";
import assert from "node:assert/strict";
import { AgentEvent, AgentTool, parseAgentReply, runAgentLoop } from "./agentLoop";

const tools: AgentTool<{ calls: string[] }>[] = [
  {
    name: "class_summary",
    kind: "read",
    description: "facts",
    activity: (a) => `Looking at ${a.grade}`,
    run: async (ctx, a) => {
      ctx.calls.push(`summary ${a.grade}`);
      return { children: 5, needHelp: ["Ravi"] };
    },
  },
  {
    name: "give_work",
    kind: "action",
    description: "propose work",
    prepare: async (_ctx, a) => ({ args: { ...a, studentIds: ["s1"] }, label: `Give ${a.title} to Ravi` }),
  },
  {
    name: "fail_tool",
    kind: "read",
    description: "always fails",
    run: async () => {
      throw new Error("boom");
    },
  },
];

const scripted = (replies: object[]) => {
  const prompts: string[] = [];
  let i = 0;
  return {
    prompts,
    generate: async (p: string) => {
      prompts.push(p);
      return JSON.stringify(replies[Math.min(i++, replies.length - 1)]);
    },
  };
};

test("args come as a JSON string or an object", () => {
  assert.deepEqual(parseAgentReply('{"thought":"t","tool":"x","args":"{\\"grade\\":\\"Class 5\\"}","answer":"","followUps":[]}')?.args, { grade: "Class 5" });
  assert.deepEqual(parseAgentReply('noise {"tool":"x","args":{"a":1}} tail')?.args, { a: 1 });
  assert.equal(parseAgentReply("not json"), null);
});

test("reads, then proposes an action, then answers — actions are never run", async () => {
  const ctx = { calls: [] as string[] };
  const events: AgentEvent[] = [];
  const g = scripted([
    { thought: "check the class", tool: "class_summary", args: '{"grade":"Class 5"}', answer: "", followUps: [] },
    { thought: "Ravi needs reading", tool: "give_work", args: '{"grade":"Class 5","title":"The Crow"}', answer: "", followUps: [] },
    { thought: "done", tool: "", args: "", answer: "Ravi needs help. I prepared work — tap Confirm.", followUps: ["Who else?"] },
  ]);
  const out = await runAgentLoop({ ctx, tools, prompt: "P", generate: g.generate, onEvent: (e) => events.push(e) });
  assert.deepEqual(ctx.calls, ["summary Class 5"]);
  assert.equal(out.proposals.length, 1);
  assert.deepEqual(out.proposals[0].args.studentIds, ["s1"]);
  assert.equal(out.answer, "Ravi needs help. I prepared work — tap Confirm.");
  assert.deepEqual(events.map((e) => e.type), ["step", "step", "proposal", "answer"]);
  // The model saw the first result and the "proposed, not done" note.
  assert.match(g.prompts[1], /needHelp/);
  assert.match(g.prompts[2], /PROPOSED \(not done yet\)/);
});

test("errors, unknown tools and repeats are reported back to the model", async () => {
  const ctx = { calls: [] as string[] };
  const g = scripted([
    { thought: "", tool: "fail_tool", args: "{}", answer: "", followUps: [] },
    { thought: "", tool: "nope", args: "{}", answer: "", followUps: [] },
    { thought: "", tool: "class_summary", args: '{"grade":"Class 1"}', answer: "", followUps: [] },
    { thought: "", tool: "class_summary", args: '{"grade":"Class 1"}', answer: "", followUps: [] },
    { thought: "", tool: "", args: "", answer: "ok", followUps: [] },
  ]);
  const out = await runAgentLoop({ ctx, tools, prompt: "P", generate: g.generate, onEvent: () => undefined });
  assert.equal(out.answer, "ok");
  assert.equal(ctx.calls.length, 1); // the repeat did not run again
  assert.match(g.prompts[1], /ERROR: boom/);
  assert.match(g.prompts[2], /no tool "nope"/);
  assert.match(g.prompts[4], /already did exactly this/);
});

test("the last step must answer", async () => {
  const g = scripted([{ thought: "", tool: "class_summary", args: '{"grade":"Class 2"}', answer: "partial answer", followUps: [] }]);
  const out = await runAgentLoop({ ctx: { calls: [] }, tools, prompt: "P", generate: g.generate, onEvent: () => undefined, maxSteps: 2 });
  assert.match(g.prompts[1], /LAST step/);
  assert.equal(out.answer, "partial answer");
});
