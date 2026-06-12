import { NextResponse } from 'next/server';
import { db, campaigns, communications, orders } from '@xeno/db';
import { eq, sql } from 'drizzle-orm';
import { summarizeCampaign } from '@xeno/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!camp) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`sum(case when state in ('sent','delivered','opened','clicked','converted') then 1 else 0 end)::int`,
      delivered: sql<number>`sum(case when state in ('delivered','opened','clicked','converted') then 1 else 0 end)::int`,
      opened: sql<number>`sum(case when state in ('opened','clicked','converted') then 1 else 0 end)::int`,
      clicked: sql<number>`sum(case when state in ('clicked','converted') then 1 else 0 end)::int`,
      converted: sql<number>`sum(case when state = 'converted' then 1 else 0 end)::int`,
    })
    .from(communications)
    .where(eq(communications.campaignId, id));

  const [{ revenue }] = await db
    .select({
      revenue: sql<number>`coalesce(sum(total)::float, 0)`,
    })
    .from(orders)
    .where(eq(orders.attributedCampaignId, id));

  const perChannelRows = await db
    .select({
      channel: communications.channel,
      sent: sql<number>`sum(case when state in ('sent','delivered','opened','clicked','converted') then 1 else 0 end)::int`,
      delivered: sql<number>`sum(case when state in ('delivered','opened','clicked','converted') then 1 else 0 end)::int`,
      converted: sql<number>`sum(case when state = 'converted' then 1 else 0 end)::int`,
    })
    .from(communications)
    .where(eq(communications.campaignId, id))
    .groupBy(communications.channel);

  const perVariantRows = await db
    .select({
      variantTag: communications.variantTag,
      sent: sql<number>`count(*)::int`,
      converted: sql<number>`sum(case when state = 'converted' then 1 else 0 end)::int`,
    })
    .from(communications)
    .where(eq(communications.campaignId, id))
    .groupBy(communications.variantTag);

  const summary = await summarizeCampaign({
    campaignName: camp.name,
    goal: camp.goal,
    metrics: {
      audienceSize: agg.total,
      sent: agg.sent,
      delivered: agg.delivered,
      opened: agg.opened,
      clicked: agg.clicked,
      converted: agg.converted,
      revenue,
      perChannel: Object.fromEntries(perChannelRows.map((r) => [r.channel, r])),
      perVariant: Object.fromEntries(perVariantRows.map((r) => [r.variantTag, r])),
    },
  });

  return NextResponse.json({
    summary,
    metrics: { ...agg, revenue, perChannel: perChannelRows, perVariant: perVariantRows },
  });
}
