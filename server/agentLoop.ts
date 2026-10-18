// A small, provider-independent agent loop (ReAct style): each step the model
// returns JSON {thought, tool, args, answer, followUps}; a "read" tool runs at
// once and its result is shown to the model in the next step; an "action" or
// "ui" tool is never run here — it is handed back as a proposal the person
// confirms (actions) or taps (ui). The loop ends when the model answers, after
// maxSteps, or when it repeats itself. Works with any text model that can
// follow a JSON schema (Gemini, Ollama), so no vendor tool-calling API is
// needed. Pure apart from the injected generate/tools, so it is unit tested.

export type ToolKind = "read" | "action" | "ui";

export interface AgentTool<Ctx> {
  name: string;
  kind: ToolKind;
  /** One line for the model: what it does and its arguments. */
  description: string;
  /** read: the observation (any JSON). */
  run?: (ctx: Ctx, args: Record<string, any>) => Promise<unknown>;
  /** action/ui: check and complete the arguments, and say in words what will happen. */
  prepare?: (ctx: Ctx, args: Record<string, any>) => Promise<{ args: Record<string, any>; label: string }>;
  /** Short words for the person while it runs, e.g. "Looking at Class 5". */
  activity?: (args: Record<string, any>) => string;
}

export interface AgentStep {
  n: number;
  thought: string;
  tool: string;
  kind: ToolKind | "answer";
  args: Record<string, any>;
  /** What the person sees for this step. */
  summary: string;
  /** What the model sees next (read result, or "proposed" / an error). */
  observation: string;
}

export interface ProposedAction {
  tool: string;
  kind: "action" | "ui";
  args: Record<string, any>;
  label: string;
}

export type AgentEvent =
  | { type: "step"; step: Omit<AgentStep, "observation"> }
  | { type: "proposal"; action: ProposedAction }
  | { type: "answer"; answer: string; followUps: string[] };

export const AGENT_SCHEMA = {
  type: "object",
  properties: {
    thought: { type: "string" },
    tool: { type: "string" },
    args: { type: "string" },
    answer: { type: "string" },
    followUps: { type: "array", items: { type: "string" } },
  },
  required: ["thought", "tool", "args", "answer", "followUps"],
};

export function parseAgentReply(text: string): { thought: string; tool: string; args: Record<string, any>; answer: string; followUps: string[] } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1));
    let args: Record<string, any> = {};
    if (raw.args && typeof raw.args === "object") args = raw.args;
    else if (typeof raw.args === "string" && raw.args.trim()) {
      try {
        const parsed = JSON.parse(raw.args);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed;
      } catch {
        args = {};
      }
    }
    return {
      thought: String(raw.thought || "").slice(0, 400),
      tool: String(raw.tool || "").trim(),
      args,
      answer: String(raw.answer || "").trim(),
      followUps: (Array.isArray(raw.followUps) ? raw.followUps : []).map((f: unknown) => String(f).slice(0, 120)).filter(Boolean).slice(0, 3),
    };
  } catch {
    return null;
  }
}

const clip = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…(cut)` : text;
};

export async function runAgentLoop<Ctx>(input: {
  ctx: Ctx;
  tools: AgentTool<Ctx>[];
  /** Everything before the steps: who the agent is, rules, the tool list, the conversation. */
  prompt: string;
  generate: (prompt: string) => Promise<string>;
  onEvent: (event: AgentEvent) => void;
  maxSteps?: number;
  maxObservation?: number;
}): Promise<{ steps: AgentStep[]; proposals: ProposedAction[]; answer: string; followUps: string[] }> {
  const { ctx, tools, prompt, generate, onEvent } = input;
  const maxSteps = input.maxSteps ?? 7;
  const maxObservation = input.maxObservation ?? 3500;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const steps: AgentStep[] = [];
  const proposals: ProposedAction[] = [];
  const seen = new Set<string>();
  let failures = 0;

  const transcript = () =>
    steps.length
      ? `\n\nSTEPS SO FAR:\n${steps
          .map((s) => `Step ${s.n}: thought: ${s.thought}\n  tool: ${s.tool || "(none)"} ${s.tool ? JSON.stringify(s.args) : ""}\n  result: ${s.observation}`)
          .join("\n")}`
      : "";

  for (let n = 1; n <= maxSteps; n++) {
    const last = n === maxSteps;
    const reply = parseAgentReply(
      await generate(
        `${prompt}${transcript()}\n\n${last ? "This is your LAST step: do not call a tool; write the answer now." : `Now step ${n}: either call ONE tool, or (tool "") write the answer.`}`
      )
    );
    if (!reply) {
      if (++failures >= 2) break;
      continue;
    }
    const tool = reply.tool && !last ? byName.get(reply.tool) : undefined;
    if (!tool) {
      if (reply.tool && !last) {
        // An unknown tool: tell the model and let it try again.
        steps.push({ n, thought: reply.thought, tool: reply.tool, kind: "read", args: reply.args, summary: "", observation: `ERROR: there is no tool "${reply.tool}".` });
        continue;
      }
      const answer = reply.answer || "I could not find an answer to that.";
      onEvent({ type: "answer", answer, followUps: reply.followUps });
      return { steps, proposals, answer, followUps: reply.followUps };
    }
    const key = `${tool.name}:${JSON.stringify(reply.args)}`;
    if (seen.has(key)) {
      steps.push({ n, thought: reply.thought, tool: tool.name, kind: tool.kind, args: reply.args, summary: "", observation: "You already did exactly this. Use the result above, or write the answer." });
      continue;
    }
    seen.add(key);
    const step: AgentStep = { n, thought: reply.thought, tool: tool.name, kind: tool.kind, args: reply.args, summary: tool.activity?.(reply.args) || tool.name, observation: "" };
    try {
      if (tool.kind === "read" && tool.run) {
        onEvent({ type: "step", step: { ...step } });
        step.observation = clip(await tool.run(ctx, reply.args), maxObservation);
      } else if (tool.prepare) {
        const prepared = await tool.prepare(ctx, reply.args);
        const action: ProposedAction = { tool: tool.name, kind: tool.kind === "ui" ? "ui" : "action", args: prepared.args, label: prepared.label };
        proposals.push(action);
        step.summary = prepared.label;
        onEvent({ type: "step", step: { ...step } });
        onEvent({ type: "proposal", action });
        step.observation =
          tool.kind === "ui"
            ? `Shown to the teacher as a button: "${prepared.label}".`
            : `PROPOSED (not done yet): "${prepared.label}". The teacher must tap Confirm; say so in your answer.`;
      }
    } catch (error: any) {
      step.observation = `ERROR: ${String(error?.message || error).slice(0, 300)}`;
      onEvent({ type: "step", step: { ...step, summary: `${step.summary} — ${step.observation}` } });
    }
    steps.push(step);
  }
  const answer = proposals.length
    ? "I have prepared the steps above for you to confirm."
    : "Sorry, I could not finish that. Please try asking in a simpler way.";
  onEvent({ type: "answer", answer, followUps: [] });
  return { steps, proposals, answer, followUps: [] };
}
