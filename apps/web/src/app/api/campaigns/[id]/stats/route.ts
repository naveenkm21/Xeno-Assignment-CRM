import { NextResponse } from 'next/server';
import { db, communications, commEvents } from '@xeno/db';
import { eq, sql, desc } from 'drizzle-orm';
import { lifecycleStates } from '@xeno/types';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Funnel counts — how many comms ever reached each state. The events
  // table is the source of truth for "ever reached"; communications.state
  // is the latest. We compute the funnel from communications.state with
  // upward-counting (delivered counts in 'opened' bucket too).
  const rows = await db
    .select({
      state: communications.state,
      count: sql<number>`count(*)::int`,
      channel: communications.channel,
      variantTag: communications.variantTag,
    })
    .from(communications)
    .where(eq(communications.campaignId, id))
    .groupBy(communications.state, communications.channel, communications.variantTag);

  const funnel: Record<string, number> = Object.fromEntries(
    lifecycleStates.map((s) => [s, 0]),
  );
  const perChannel: Record<string, { sent: number; delivered: number; converted: number }> = {};
  const perVariant: Record<string, { sent: number; converted: number }> = {};

  // Cumulative counts: anyone who reached 'delivered' also reached 'sent', etc.
  const cumulativeOrder = ['queued', 'sent', 'delivered', 'opened', 'clicked', 'converted'] as const;
  for (const r of rows) {
    const idx = cumulativeOrder.indexOf(r.state as (typeof cumulativeOrder)[number]);
    if (idx >= 0) {
      for (let k = 0; k <= idx; k++) {
        funnel[cumulativeOrder[k]!]! += r.count;
      }
    } else {
      funnel[r.state]! += r.count;
    }
    perChannel[r.channel] ??= { sent: 0, delivered: 0, converted: 0 };
    if (idx >= 1) perChannel[r.channel]!.sent += r.count;
    if (idx >= 2) perChannel[r.channel]!.delivered += r.count;
    if (r.state === 'converted') perChannel[r.channel]!.converted += r.count;

    perVariant[r.variantTag] ??= { sent: 0, converted: 0 };
    if (idx >= 1) perVariant[r.variantTag]!.sent += r.count;
    if (r.state === 'converted') perVariant[r.variantTag]!.converted += r.count;
  }

  // Recent events for the live log.
  const recentEvents = await db
    .select({
      commId: commEvents.commId,
      state: commEvents.state,
      occurredAt: commEvents.occurredAt,
      meta: commEvents.meta,
    })
    .from(commEvents)
    .innerJoin(communications, eq(commEvents.commId, communications.id))
    .where(eq(communications.campaignId, id))
    .orderBy(desc(commEvents.occurredAt))
    .limit(20);

  // Revenue rolled up from converted comms.
  const [{ revenue }] = await db
    .select({
      revenue: sql<number>`coalesce(sum(case when state = 'converted' then 1 else 0 end), 0)::int`,
    })
    .from(communications)
    .where(eq(communications.campaignId, id));

  return NextResponse.json({
    funnel,
    perChannel,
    perVariant,
    recentEvents,
    revenue,
  });
}
