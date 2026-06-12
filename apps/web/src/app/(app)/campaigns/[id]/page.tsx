import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, campaigns } from '@xeno/db';
import { eq } from 'drizzle-orm';
import { IconArrowLeft } from '@tabler/icons-react';
import { CampaignMonitor } from '@/components/campaigns/monitor';

export const dynamic = 'force-dynamic';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!camp) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <header className="space-y-3">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
        >
          <IconArrowLeft size={13} /> all campaigns
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  camp.status === 'completed'
                    ? 'chip pill-lime'
                    : camp.status === 'sending'
                      ? 'chip pill-violet'
                      : camp.status === 'failed'
                        ? 'chip pill-pink'
                        : 'chip'
                }
              >
                {camp.status === 'sending' && <span className="dot-live !w-1.5 !h-1.5" />}
                {camp.status}
              </span>
              <span className="text-xs text-ink-faint">
                started{' '}
                {camp.startedAt
                  ? new Date(camp.startedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em]">{camp.name}</h1>
            <p className="text-sm text-ink-soft max-w-2xl">{camp.goal}</p>
          </div>
        </div>
      </header>
      <CampaignMonitor campaignId={camp.id} status={camp.status} />
    </div>
  );
}
