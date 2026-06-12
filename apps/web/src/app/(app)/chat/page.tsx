import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { db, conversations } from '@xeno/db';
import { desc, eq } from 'drizzle-orm';
import { IconMessage, IconArrowUpRight, IconSparkles } from '@tabler/icons-react';
import { BriefInput } from '@/components/copilot/brief-input';

export const dynamic = 'force-dynamic';

export default async function ChatIndex() {
  const { userId } = await auth();
  const list = userId
    ? await db
        .select()
        .from(conversations)
        .where(eq(conversations.createdBy, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(20)
    : [];
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <section className="space-y-5">
        <div className="chip pill-violet inline-flex !py-1.5 !px-3">
          <IconSparkles size={11} /> new brief
        </div>
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-[-0.04em] leading-[1.05]">
            start a <span className="text-gradient">new brief</span>
          </h1>
          <p className="text-[15px] text-ink-soft mt-3">
            drop a goal in plain english. the copilot drives the rest.
          </p>
        </div>
        <BriefInput
          suggestions={[
            "win back lapsed shoppers",
            "promote winter blend to VIPs",
            "recover cart abandoners",
          ]}
        />
      </section>
      {list.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
            past conversations
          </h2>
          <div className="space-y-2">
            {list.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className="surface flex items-center gap-3 px-4 py-3 glow-hover group"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
                  <IconMessage size={14} className="text-violet-300" />
                </div>
                <div className="flex-1 min-w-0 text-sm font-medium truncate">
                  {c.title ?? 'Untitled'}
                </div>
                <IconArrowUpRight
                  size={14}
                  className="text-ink-faint group-hover:text-ink group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
