import { NextResponse } from 'next/server';
import { db, communications, commEvents, campaigns, orders } from '@xeno/db';
import { receiptBatchSchema, type LifecycleState } from '@xeno/types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

const SECRET = process.env.CHANNEL_WEBHOOK_SECRET ?? '';

// Rank lifecycle states so a late-arriving 'opened' can never overwrite a
// 'clicked' that we've already recorded. Terminal states (failed, bounced,
// unsubscribed, converted) are sticky.
const RANK: Record<LifecycleState, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  converted: 5,
  failed: 5,
  bounced: 5,
  unsubscribed: 5,
};
const TERMINAL = new Set<LifecycleState>(['failed', 'bounced', 'unsubscribed', 'converted']);

function verify(sig: string | null, body: string) {
  if (!sig || !SECRET) return false;
  const expected = createHmac('sha256', SECRET).update(body).digest('hex');
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-xeno-signature');
  if (!verify(sig, raw)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = receiptBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  const touchedCampaigns = new Set<string>();

  for (const r of parsed.data.receipts) {
    touchedCampaigns.add(r.campaignId);
    try {
      // 1) Append-only event log. The unique index on
      //    (commId, state, occurredAt) drops duplicate webhook deliveries —
      //    that IS our idempotency boundary.
      const ev = await db
        .insert(commEvents)
        .values({
          commId: r.commId,
          state: r.state,
          occurredAt: new Date(r.occurredAt),
          meta: r.meta,
        })
        .onConflictDoNothing({
          target: [commEvents.commId, commEvents.state, commEvents.occurredAt],
        })
        .returning({ id: commEvents.id });

      if (ev.length === 0) {
        skipped++;
        continue;
      }
      inserted++;

      // 2) Roll up to the communications row. We do read-modify-write
      //    instead of a clever conditional UPDATE because:
      //    (a) the agent is single-tenant-per-row in practice — receipts
      //        for a comm arrive serially from one worker;
      //    (b) the next layer's correctness is anchored in commEvents,
      //        which is already idempotent.
      const [comm] = await db
        .select()
        .from(communications)
        .where(eq(communications.id, r.commId))
        .limit(1);
      if (!comm) continue;

      const currentRank = RANK[comm.state];
      const incomingRank = RANK[r.state];
      const isTerminalAlready = TERMINAL.has(comm.state);
      const shouldAdvance =
        !isTerminalAlready && (incomingRank > currentRank || TERMINAL.has(r.state));

      const updates: Record<string, unknown> = {
        lastEventAt: new Date(r.occurredAt),
      };
      if (shouldAdvance) updates.state = r.state;
      if (r.state === 'sent' && !comm.sentAt) updates.sentAt = new Date(r.occurredAt);
      if ((r.state === 'failed' || r.state === 'bounced') && !comm.failureReason) {
        updates.failureReason = String(r.meta?.reason ?? r.state);
      }

      await db.update(communications).set(updates).where(eq(communications.id, r.commId));

      // 3) If this is a conversion, attribute an order so the insights view
      //    can compute revenue without a second hop.
      if (r.state === 'converted') {
        const orderValue = Number(r.meta?.order_value ?? 0);
        if (orderValue > 0) {
          const [ord] = await db
            .insert(orders)
            .values({
              customerId: comm.customerId,
              total: orderValue.toFixed(2),
              itemCount: 1,
              channelOrigin: 'campaign',
              placedAt: new Date(r.occurredAt),
              attributedCampaignId: comm.campaignId,
              attributedCommId: comm.id,
            })
            .returning({ id: orders.id });
          await db
            .update(communications)
            .set({ attributedOrderId: ord.id })
            .where(eq(communications.id, r.commId));
        }
      }
    } catch (err) {
      // A single-row failure must not drop the rest of the batch.
      console.error('receipt ingest error', err);
    }
  }

  // After ingestion, mark any campaign 'completed' if no comms remain in a
  // non-terminal state. Cheap query: COUNT against an indexed partial.
  for (const cid of touchedCampaigns) {
    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)::int` })
      .from(communications)
      .where(
        sql`${communications.campaignId} = ${cid} and ${communications.state}::text in ('queued','sent','delivered','opened','clicked')`,
      );
    if (remaining === 0) {
      await db
        .update(campaigns)
        .set({ status: 'completed', completedAt: new Date() })
        .where(sql`${campaigns.id} = ${cid} and ${campaigns.status} = 'sending'`);
    }
  }

  return NextResponse.json({ inserted, skipped });
}
