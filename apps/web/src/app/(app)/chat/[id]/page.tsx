import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { db, conversations, messages } from '@xeno/db';
import { eq, asc } from 'drizzle-orm';
import { ChatView } from '@/components/copilot/chat-view';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!convo || convo.createdBy !== userId) notFound();

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return (
    <ChatView
      conversationId={id}
      initialMessages={history.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolResult: m.toolResult as Record<string, unknown> | null,
      }))}
    />
  );
}
