import { NextResponse } from 'next/server';
import { db, customers, orders, communications, commEvents, campaigns } from '@xeno/db';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const customerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.placedAt));

  const customerComms = await db
    .select({
      id: communications.id,
      campaignId: communications.campaignId,
      channel: communications.channel,
      variantTag: communications.variantTag,
      body: communications.body,
      subject: communications.subject,
      state: communications.state,
      sentAt: communications.sentAt,
      lastEventAt: communications.lastEventAt,
      attributedOrderId: communications.attributedOrderId,
      failureReason: communications.failureReason,
      createdAt: communications.createdAt,
      campaignName: campaigns.name,
    })
    .from(communications)
    .leftJoin(campaigns, eq(communications.campaignId, campaigns.id))
    .where(eq(communications.customerId, id))
    .orderBy(desc(communications.createdAt));

  const events = customerComms.length
    ? await db
        .select({
          id: commEvents.id,
          commId: commEvents.commId,
          state: commEvents.state,
          occurredAt: commEvents.occurredAt,
          meta: commEvents.meta,
        })
        .from(commEvents)
        .where(
          sql`${commEvents.commId} in (${sql.join(
            customerComms.map((c) => sql`${c.id}`),
            sql`, `,
          )})`,
        )
        .orderBy(desc(commEvents.occurredAt))
        .limit(200)
    : [];

  const ltv = customerOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalComms = customerComms.length;
  const opened = customerComms.filter((c) =>
    ['opened', 'clicked', 'converted'].includes(c.state as string),
  ).length;
  const clicked = customerComms.filter((c) =>
    ['clicked', 'converted'].includes(c.state as string),
  ).length;
  const converted = customerComms.filter((c) => c.state === 'converted').length;

  return NextResponse.json({
    customer,
    stats: {
      ltv,
      orderCount: customerOrders.length,
      avgOrderValue: customerOrders.length ? ltv / customerOrders.length : 0,
      lastOrderAt: customerOrders[0]?.placedAt ?? null,
      totalComms,
      opened,
      clicked,
      converted,
      openRate: totalComms ? opened / totalComms : 0,
      ctr: opened ? clicked / opened : 0,
    },
    orders: customerOrders,
    communications: customerComms,
    events,
  });
}
