import Groq from 'groq-sdk';
import type { ChatCompletion, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

export const PLANNER_MODEL = process.env.GROQ_PLANNER_MODEL ?? 'llama-3.3-70b-versatile';
export const DRAFTER_MODEL = process.env.GROQ_DRAFTER_MODEL ?? 'llama-3.1-8b-instant';

let _groq: Groq | null = null;
/**
 * Lazily construct the Groq client. The SDK does not actually validate the
 * API key at construction time, but we still guard so importing this module
 * during `next build` (without env vars) doesn't break.
 */
export function getGroq(): Groq {
  if (_groq) return _groq;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required (free tier at https://console.groq.com).');
  }
  _groq = new Groq({ apiKey });
  return _groq;
}
export const groq = new Proxy({} as Groq, {
  get(_t, p, r) {
    return Reflect.get(getGroq() as object, p, r);
  },
});

export type ChatMessage = ChatCompletionMessageParam;

/**
 * Run a chat completion with a single auto-retry on transient errors. Groq's
 * free tier is generous but occasionally returns 429 under burst load.
 */
export async function chat(args: {
  model: string;
  messages: ChatMessage[];
  tools?: Parameters<typeof groq.chat.completions.create>[0]['tools'];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' } | { type: 'text' };
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatCompletion> {
  const body = {
    model: args.model,
    messages: args.messages,
    tools: args.tools,
    tool_choice: args.toolChoice,
    response_format: args.responseFormat,
    temperature: args.temperature ?? 0.4,
    max_tokens: args.maxTokens ?? 2048,
  } as const;
  try {
    return await groq.chat.completions.create(body);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429 || (status && status >= 500)) {
      await new Promise((r) => setTimeout(r, 800));
      return groq.chat.completions.create(body);
    }
    throw err;
  }
}

/**
 * Streaming variant — returns the SDK's async iterable of chunks. The route
 * handler is responsible for translating chunks into SSE events.
 */
export async function chatStream(args: Parameters<typeof chat>[0]) {
  return groq.chat.completions.create({
    model: args.model,
    messages: args.messages,
    tools: args.tools,
    tool_choice: args.toolChoice,
    response_format: args.responseFormat,
    temperature: args.temperature ?? 0.4,
    max_tokens: args.maxTokens ?? 2048,
    stream: true,
  });
}
