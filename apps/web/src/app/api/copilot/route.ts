import { auth } from '@clerk/nextjs/server';
import { db, conversations, messages } from '@xeno/db';
import { eq, asc } from 'drizzle-orm';
import { runAgent } from '@xeno/ai/agent';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('unauthorized', { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) return new Response('bad request', { status: 400 });
  const { conversationId, message } = parse.data;

  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!convo || convo.createdBy !== userId) {
    return new Response('not found', { status: 404 });
  }

  // If the caller passed a new message, persist it before running the agent.
  if (message) {
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: message,
    });
  }

  // Load history into the format the agent expects.
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  // Last user message drives the turn; preceding ones become history.
  const last = history.at(-1);
  if (!last || last.role !== 'user') {
    return new Response('no pending user message', { status: 400 });
  }
  const chatHistory = history.slice(0, -1).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      let assistantBuf = '';
      let finalPlan: unknown = undefined;
      let finalPortfolio: unknown = undefined;

      try {
        for await (const ev of runAgent({
          userMessage: last.content,
          history: chatHistory,
          mode: (convo.mode as 'plan' | 'autopilot' | undefined) ?? 'plan',
        })) {
          send(ev.kind, ev);
          if (ev.kind === 'reasoning') assistantBuf += ev.text;
          if (ev.kind === 'final') {
            assistantBuf = ev.text || assistantBuf;
            finalPlan = ev.plan;
            finalPortfolio = ev.portfolio;
          }
        }
      } catch (err) {
        send('error', { message: (err as Error).message });
      } finally {
        // Persist the assistant turn — store the portfolio if present, plan otherwise.
        // The chat-view discriminates on shape (campaigns[] vs single CampaignPlan).
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: assistantBuf || '(no response)',
          toolResult: (finalPortfolio ?? finalPlan) as Record<string, unknown> | undefined,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
