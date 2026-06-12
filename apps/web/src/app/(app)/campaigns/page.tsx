import Link from 'next/link';
import { db, campaigns } from '@xeno/db';
import { desc } from 'drizzle-orm';
import { IconArrowUpRight, IconSparkles } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export default async function CampaignsList() {
  const list = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(50);
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="chip pill-violet inline-flex !py-1 !px-2.5 mb-3">campaigns</div>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">
            every brief you&apos;ve <span className="text-gradient">shipped</span>
          </h1>
          <p className="text-sm text-ink-soft mt-2">
            live, completed, failed — all here.
          </p>
        </div>
        <Link href="/home" className="btn-primary !py-2.5 !px-4">
          <IconSparkles size={14} /> new campaign
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="surface p-12 text-center">
          <div
            className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-md"
            style={{ background: 'var(--grad-violet)' }}
          >
            <IconSparkles size={20} className="text-white" />
          </div>
          <h2 className="font-semibold mb-1 text-lg">no campaigns yet</h2>
          <p className="text-sm text-ink-soft mb-5">
            brief the copilot and your first one lands here.
          </p>
          <Link href="/home" className="btn-primary !py-2.5 !px-4 inline-flex">
            start one <IconArrowUpRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="surface flex items-center justify-between px-5 py-4 glow-hover group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-ink-faint mt-0.5 line-clamp-1">{c.goal}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={
                    c.status === 'completed'
                      ? 'chip pill-lime'
                      : c.status === 'sending'
                        ? 'chip pill-violet'
                        : c.status === 'failed'
                          ? 'chip pill-pink'
                          : 'chip'
                  }
                >
                  {c.status === 'sending' && <span className="dot-live !w-1.5 !h-1.5" />}
                  {c.status}
                </span>
                <IconArrowUpRight
                  size={14}
                  className="text-ink-faint group-hover:text-ink group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
