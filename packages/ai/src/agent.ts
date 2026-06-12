import { chat, PLANNER_MODEL, type ChatMessage } from './client';
import { PLANNER_SYSTEM_PROMPT, AUTOPILOT_SYSTEM_PROMPT } from './prompts';
import { tools, autopilotTools, toolHandlers, type ToolContext, type ToolName } from './tools/index';

export type AgentMode = 'plan' | 'autopilot';

export type AgentEvent =
  | { kind: 'reasoning'; text: string }
  | { kind: 'tool_call'; name: ToolName; args: unknown; id: string }
  | { kind: 'tool_result'; name: ToolName; result: unknown; id: string }
  | { kind: 'tool_error'; name: ToolName; error: string; id: string }
  | { kind: 'final'; plan?: unknown; portfolio?: unknown; text: string }
  | { kind: 'done' };

const MAX_TURNS_PLAN = 6;
const MAX_TURNS_AUTOPILOT = 14; // Autopilot does N campaigns → more tool calls per turn.

/**
 * Multi-turn agent loop. The marketer's brief comes in as the user message;
 * we let the planner LLM call tools until it either calls `finalize_plan`
 * (plan mode) or `finalize_portfolio` (autopilot mode), or hits the turn budget.
 *
 * Yields a stream of events the route handler can serialise to SSE.
 */
export async function* runAgent(opts: {
  userMessage: string;
  history?: ChatMessage[];
  mode?: AgentMode;
}): AsyncGenerator<AgentEvent> {
  const mode: AgentMode = opts.mode ?? 'plan';
  const ctx: ToolContext = {};
  const systemPrompt = mode === 'autopilot' ? AUTOPILOT_SYSTEM_PROMPT : PLANNER_SYSTEM_PROMPT;
  const activeTools = mode === 'autopilot' ? autopilotTools : tools;
  const maxTurns = mode === 'autopilot' ? MAX_TURNS_AUTOPILOT : MAX_TURNS_PLAN;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(opts.history ?? []),
    { role: 'user', content: opts.userMessage },
  ];

  let plan: unknown = undefined;
  let portfolio: unknown = undefined;
  let finalText = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const completion = await chat({
      model: PLANNER_MODEL,
      messages,
      tools: activeTools,
      toolChoice: 'auto',
      temperature: 0.3,
      maxTokens: mode === 'autopilot' ? 4000 : 1500,
    });

    const choice = completion.choices[0];
    if (!choice) break;
    const msg = choice.message;
    const content = msg.content ?? '';
    if (content.trim()) yield { kind: 'reasoning', text: content };
    messages.push(msg);

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      finalText = content;
      yield { kind: 'final', plan, portfolio, text: finalText };
      yield { kind: 'done' };
      return;
    }

    for (const call of toolCalls) {
      const name = call.function.name as ToolName;
      let args: unknown;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        const error = `invalid JSON for ${name}: ${call.function.arguments}`;
        yield { kind: 'tool_error', name, error, id: call.id };
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error }),
        });
        continue;
      }
      yield { kind: 'tool_call', name, args, id: call.id };

      const handler = toolHandlers[name];
      if (!handler) {
        const error = `unknown tool: ${name}`;
        yield { kind: 'tool_error', name, error, id: call.id };
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error }),
        });
        continue;
      }

      try {
        const result = await handler(args, ctx);
        yield { kind: 'tool_result', name, result, id: call.id };
        if (name === 'finalize_plan') plan = result;
        if (name === 'finalize_portfolio') portfolio = result;

        // Trim huge results before feeding back — keep size + sample, not full rows.
        const serialised = JSON.stringify(result, (key, value) => {
          if (Array.isArray(value) && value.length > 8) return value.slice(0, 8);
          return value;
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: serialised,
        });

        if (name === 'finalize_plan') {
          finalText = 'Plan ready — review the proposal above and tap Approve to send.';
          yield { kind: 'final', plan, portfolio, text: finalText };
          yield { kind: 'done' };
          return;
        }
        if (name === 'finalize_portfolio') {
          finalText = 'Portfolio ready — review each campaign or hit "Ship all" to launch.';
          yield { kind: 'final', plan, portfolio, text: finalText };
          yield { kind: 'done' };
          return;
        }
      } catch (e) {
        const error = (e as Error).message;
        yield { kind: 'tool_error', name, error, id: call.id };
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error }),
        });
      }
    }
  }

  yield {
    kind: 'final',
    plan,
    portfolio,
    text: 'Hit turn budget — let me know how to narrow this down.',
  };
  yield { kind: 'done' };
}
