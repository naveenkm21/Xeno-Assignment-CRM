import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, conversations, messages } from '@xeno/db';
import { z } from 'zod';

const bodySchema = z.object({
  initialMessage: z.string().min(1).max(2000),
  mode: z.enum(['plan', 'autopilot']).default('plan'),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const [convo] = await db
    .insert(conversations)
    .values({
      createdBy: userId,
      title: parsed.data.initialMessage.slice(0, 80),
      mode: parsed.data.mode,
    })
    .returning({ id: conversations.id });

  await db.insert(messages).values({
    conversationId: convo.id,
    role: 'user',
    content: parsed.data.initialMessage,
  });

  return NextResponse.json({ id: convo.id });
}
